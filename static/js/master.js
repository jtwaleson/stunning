var pairings = {};
var current_pairing = null;
var clients = {};
$(function () {
    var add_client = function (id) {
        if (!(id in clients)) {
            $('<li>').text(id).appendTo('.idle-clients').draggable({revert: true, helper: 'clone'});
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
    socket.on('client_disconnected', function (client_id) {
        alert(client_id);
        $('.idle-clients li').each(function () {
            if ($(this).text() === client_id) {
                $(this).remove();
            }
        });
        $('.clients .node').each(function () {
            if ($(this).attr('data-client') === client_id) {
                $(this).remove();
            }
        });
    });
    socket.on('nn_output', function (data) {
        $('<p>').text(JSON.stringify(data)).prependTo('.output');
        $('.output').prepend('<hr>');
    });
    $('.add-layer').click(function (event) {
        event.preventDefault();
        var new_layer_code = String.fromCharCode($('tr.clients td').length + 65);
        $('<th>').appendTo('table thead tr').text(new_layer_code);
        var td = $('<td>').appendTo('tr.clients').append('<div>').attr('data-layer', new_layer_code);
        td.find('div').addClass('layer').droppable({
            accept: function (drag) { return true; },
            hoverClass: 'hover',
            activeClass: 'active',
            drop: function (event, ui) {
                var client_id = $(ui.helper).text();
                var node_number_in_layer = 0;
                var numbers = {};
                $(this).find('.node').each(function () {
                    numbers[parseInt($(this).attr('data-num'), 10)] = true;
                });
                while (node_number_in_layer in numbers) {
                    node_number_in_layer += 1;
                }
                $('<div>')
                    .addClass('node')
                    .attr('data-client', client_id)
                    .attr('data-num', node_number_in_layer)
                    .text(new_layer_code + node_number_in_layer)
                    .appendTo(this);
                ui.helper.remove();
                ui.draggable.remove();
                $(this).closest('td').prev('td').find('.node').each(function () {
                    var pairing = {
                        id: window.uuid.v4(),
                        offerer: {id: $(this).attr('data-client'), sdp: null},
                        answerer: {id: client_id, sdp: null},
                    };
                    pairings[pairing.id] = pairing;
                    socket.emit('create_offer', {receiver: pairing.offerer.id, pairing_id: pairing.id});
                });
                $(this).closest('td').next('td').find('.node').each(function () {
                    var pairing = {
                        id: window.uuid.v4(),
                        offerer: {id: client_id, sdp: null},
                        answerer: {id: $(this).attr('data-client'), sdp: null},
                    };
                    pairings[pairing.id] = pairing;
                    socket.emit('create_offer', {receiver: pairing.offerer.id, pairing_id: pairing.id});
                });
            },
        });
    });
    var nn = [];
    $('.add-layer').click();
    $('.add-layer').click();
    $('.add-layer').click();
    $('.add-layer').click();
    $('.add-layer').click();
    $('.input').click(function () {
        var value = prompt('input plz');
        var id = Math.floor(Math.random() * 10000);
        $('.clients td').first().find('.node').each(function () {
            socket.emit('nn_input', {receiver: $(this).attr('data-client'), value: {value: parseFloat(value), id: id}});
        });
    });
});
