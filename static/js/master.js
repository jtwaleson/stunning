var pairings = {};
var current_pairing = null;
var clients = {};
$(function () {
    var add_client = function (id) {
        if (!(id in clients)) {
            $('<li>').text(id).appendTo('.idle-clients');
            clients[id] = true;
        }
    };
    var socket = window.io.connect(location.hostname, {transports: ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling']});
    socket.emit('master');
    $.ajax({
        type: 'GET',
        url: '/master/clients',
        success: function (data) {
            for (var i in data) {
                add_client(data[i]);
            }
        },
        error: function (err) {
            alert(err);
        },
    });
    $('.clients').on('dblclick', 'li', function (event) {
        var id = $(this).text();
        socket.emit('nn_input', {receiver: id, value: 'hello!'});
        event.preventDefault();
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
    socket.on('new_client', function (data) {
        add_client(data);
    });
    socket.on('nn_output', function (data) {
        console.log('nn_output', data);
    });


    $('.add-layer').click(function (event) {
        event.preventDefault();
        console.log('adding layer');
        $('tr.clients').append('<td>');
    });
});
