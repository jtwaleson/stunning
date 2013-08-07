var pairings = {};
var outgoing = [];
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
        if (outgoing.length === 0) {
            socket.emit('nn_output', data);
        } else {
            for (var i in outgoing) {
                var connection = outgoing[i];
                connection.datachannel.send(data);
            }
        }
    }

    function setChannelEvents(channel, channelNameForConsoleOutput) {
        channel.onmessage = function (event) {
            send_to_outgoing(event.data);
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
        setChannelEvents(offererDataChannel, 'offerer');
    });
    socket.on('create_response', function (data) {
        var answerer = new RTCPeerConnection(iceServers, optionalRtpDataChannels);
        var answererDataChannel = answerer.createDataChannel('RTCDataChannel', {
            reliable: false
        });
        pairings[data.pairing_id] = {endpoint: answerer, datachannel: answererDataChannel};
        setChannelEvents(answererDataChannel, 'answerer');
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
        send_to_outgoing('hello!');
    });
});
