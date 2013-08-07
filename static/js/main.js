var pairings = {};
var outgoing = [];
var values = {};
$(function () {

    var iceServers = {
        iceServers: [{
            url: 'stun:stun.l.google.com:19302'
        }]
    };

    var optionalRtpDataChannels = {
        optional: [{
            RtpDataChannels: true
        }]
    };

    var RTCPeerConnection = window.webkitRTCPeerConnection;
    var RTCIceCandidate = window.RTCIceCandidate;
    var RTCDataChannel = window.RTCDataChannel;
    var RTCSessionDescription = window.RTCSessionDescription;

    function send_to_outgoing(data) {
        if (!(data.id in values)) {
            values[data.id] = 0.0;
        }
        if (values[data.id] !== false && values[data.id] > 0.5) {
            if (outgoing.length === 0) {
                socket.emit('nn_output', data);
            } else {
                for (var i in outgoing) {
                    var connection = outgoing[i];
                    var block = {
                        id: data.id,
                        value: connection.datachannel.sigma,
                    };
                    connection.datachannel.send(JSON.stringify(block));
                }
            }
            values[data.id] = false;
        }
    }

    function setChannelEvents(channel) {
        channel.sigma = Math.random(1);
        channel.onmessage = function (event) {
            console.log(event.data);
            var data = JSON.parse(event.data);
            if (!(data.id in values)) {
                values[data.id] = 0.0;
            }
            if (values[data.id] !== false) {
                values[data.id] += data.value;
            }
            send_to_outgoing(data);
        };
        channel.onopen = function () {
            console.log('channel opened');
        };
        channel.onclose = function (e) {
            console.error(e);
        };
        channel.onerror = function (e) {
            console.error(e);
        };
    }


    var mediaConstraints = {
        optional: [],
        mandatory: {
            OfferToReceiveAudio: false,
            OfferToReceiveVideo: false
        }
    };
    window.addIncoming = function () {
    };
    var socket = window.io.connect(location.hostname, {transports: ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling']});
    socket.on('connect', function (data) {
        $('.socketid').text(socket.socket.sessionid);
    });
    socket.emit('subscribe', {});
    socket.on('create_offer', function (data) {
        var offerer = new RTCPeerConnection(iceServers, optionalRtpDataChannels);
        offerer.onicecandidate = function (event) {
            if (!event || !event.candidate)  { return; }
            socket.emit('ice_candidate',
                {candidate: event.candidate, pairing_id: data.pairing_id}
            );
        };
        var offererDataChannel = offerer.createDataChannel('RTCDataChannel', {
            reliable: false
        });
        pairings[data.pairing_id] = {endpoint: offerer, datachannel: offererDataChannel};
        offerer.createOffer(function (sessionDescription) {
            socket.emit('created_offer', {sdp: sessionDescription, pairing_id: data.pairing_id});
            offerer.setLocalDescription(sessionDescription);
        }, null, mediaConstraints);
        setChannelEvents(offererDataChannel);
    });
    socket.on('create_response', function (data) {
        var answerer = new RTCPeerConnection(iceServers, optionalRtpDataChannels);
        var answererDataChannel = answerer.createDataChannel('RTCDataChannel', {
            reliable: false
        });
        pairings[data.pairing_id] = {endpoint: answerer, datachannel: answererDataChannel};
        setChannelEvents(answererDataChannel);
        answerer.onicecandidate = function (event) {
            if (!event || !event.candidate) { return; }
            socket.emit('ice_candidate',
                {candidate: event.candidate, pairing_id: data.pairing_id, resonse: true}
            );
        };
        answerer.setRemoteDescription(new RTCSessionDescription(data.offer));
        answerer.createAnswer(function (sessionDescription) {
            answerer.setLocalDescription(sessionDescription);
            socket.emit('created_response', {sdp: sessionDescription, pairing_id: data.pairing_id});
        }, null, mediaConstraints);
    });
    socket.on('make_connection', function (data) {
        var pairing = pairings[data.pairing_id];
        pairing.endpoint.setRemoteDescription(new RTCSessionDescription(data.response));
        outgoing.push(pairing);
    });
    socket.on('add_ice', function (data) {
        var pairing = pairings[data.pairing_id];
        pairing.endpoint.addIceCandidate(new RTCIceCandidate(data.candidate));
    });
    socket.on('nn_input', function (data) {
        if (!(data.id in values)) {
            values[data.id] = 0.0;
        }
        if (values[data.id] !== false) {
            values[data.id] += data.value;
        }
        send_to_outgoing(data);
    });
});
