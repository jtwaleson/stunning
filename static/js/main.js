var create_node = function () {
    var pairings = {};
    var outgoing = [];
    var incoming = [];
    var values = {};
    var identifier = null;

    var status_indicator = $('<div>').appendTo('body').text('creating....');

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


    function add_to_value(key, value) {
        if (!(key in values)) {
            values[key] = {val: 0.0, count: 0};
            setTimeout(function () {
                if (values[key].val !== false) {
                    console.log('not all values collected. timeout reached');
                    send_to_outgoing(key);
                }
            }, 5000);
        }
        if (values[key].val !== false) {
            values[key].val += value;
            values[key].count += 1;
        }
        if (values[key].count === Math.max(1, incoming.length)) {
            send_to_outgoing(key);
        }
    }

    function send_to_outgoing(key) {
        if (values[key].val !== false) {
            var val = values[key].val;
            values[key].val = false;
            if (outgoing.length === 0) {
                socket.emit('nn_output', {id: key, value: val >= 0.5 ? 1.0 : 0.0});
            } else {
                for (var i in outgoing) {
                    var connection = outgoing[i];
                    var block = {
                        id: key,
                        value: val >= 0.5 ? connection.datachannel.weight : 0.0,
                        sender: identifier,
                    };
                    connection.datachannel.send(JSON.stringify(block));
                }
            }
        }
    }

    function setChannelEvents(channel) {
        channel.onmessage = function (event) {
            var data = JSON.parse(event.data);
            add_to_value(data.id, data.value);
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
    var socket = window.io.connect(location.hostname, {transports: ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling']});
    socket.on('connect', function (data) {
        status_indicator.text(socket.socket.sessionid);
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
        offererDataChannel.weight = data.weight;
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
        incoming.push(pairings[data.pairing_id]);
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
    socket.on('set_identifier', function (data) {
        identifier = data.identifier;
        $('<h1>').text(data.identifier).prependTo('body');
    });
    socket.on('nn_input', function (data) {
        add_to_value(data.id, data.value);
    });
};

$(function () {
    create_node();
});
