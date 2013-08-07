var pairings = {};
var current_pairing = null;
$(function () {
    var socket = window.io.connect(location.hostname, {transports: ['htmlfile', 'xhr-multipart', 'xhr-polling']});
    socket.emit('master');
    $.ajax({
        type: 'GET',
        url: '/master/clients',
        success: function (data) {
            for (var i in data) {
                var item = data[i];
                $('<li>').text(item).appendTo('.clients');
            }
        },
        error: function (err) {
            alert(err);
        },
    });
    $('.clients').on('click', 'li', function (event) {
        if (current_pairing) {
            current_pairing.answerer.id = $(this).text();
            socket.emit('create_offer', {receiver: current_pairing.offerer.id, pairing_id: current_pairing.id});
            pairings[current_pairing.id] = current_pairing;
            current_pairing = null;
        } else {
            current_pairing = {
                id: window.uuid.v4(),
                offerer: {id: null, sdp: null},
                answerer: {id: null, sdp: null},
            };
            current_pairing.offerer.id = $(this).text();
        }
    });
    socket.on('ice_candidate', function (data) {
        var pairing = pairings[data.pairing_id];
        var receiver = null;
        console.log(data.sender);
        console.log(pairing.offerer.id);
        if (data.sender === pairing.offerer.id) {
            receiver = pairing.answerer.id;
        } else {
            receiver = pairing.offerer.id;
        }
        socket.emit('add_ice', {receiver: receiver, candidate: data.candidate, pairing_id: pairing.id});
    });
    socket.on('created_offer', function (data) {
        var pairing = pairings[data.pairing_id];
        pairing.offerer.sdp = data.sdp;
        socket.emit('create_response', {receiver: pairing.answerer.id, offer: pairing.offerer.sdp, pairing_id: pairing.id});
    });
    socket.on('created_response', function (data) {
        var pairing = pairings[data.pairing_id];
        pairing.answerer.sdp = data.sdp;
        socket.emit('make_connection', {receiver: pairing.offerer.id, response: pairing.answerer.sdp, pairing_id: pairing.id});
    });
});
