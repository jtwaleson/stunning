var pairings = {};
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
    var add_node_to_layer = function (client_id, layer) {
        var node_number_in_layer = 0;
        var numbers = {};
        var layer_div = $('td[data-layer=' + layer + '] .layer');
        layer_div.find('.node').each(function () {
            numbers[parseInt($(this).attr('data-num'), 10)] = true;
        });
        while (node_number_in_layer in numbers) {
            node_number_in_layer += 1;
        }
        console.log(layer_div);
        $('<div>')
        .addClass('node')
        .attr('data-client', client_id)
        .attr('data-num', node_number_in_layer)
        .text(layer + node_number_in_layer)
        .appendTo(layer_div);

        layer_div.closest('td').prev('td').find('.node').each(function () {
            var pairing = {
                id: window.uuid.v4(),
                offerer: {id: $(this).attr('data-client'), sdp: null},
                answerer: {id: client_id, sdp: null},
            };
            pairings[pairing.id] = pairing;
            socket.emit('create_offer', {receiver: pairing.offerer.id, pairing_id: pairing.id});
        });
        layer_div.closest('td').next('td').find('.node').each(function () {
            var pairing = {
                id: window.uuid.v4(),
                offerer: {id: client_id, sdp: null},
                answerer: {id: $(this).attr('data-client'), sdp: null},
            };
            pairings[pairing.id] = pairing;
            socket.emit('create_offer', {receiver: pairing.offerer.id, pairing_id: pairing.id});
        });
    };
    var add_layer = function () {
        var new_layer_code = String.fromCharCode($('tr.clients td').length + 65);
        $('<th>').appendTo('table thead tr').text(new_layer_code);
        var td = $('<td>').appendTo('tr.clients').append('<div>').attr('data-layer', new_layer_code);
        td.find('div').addClass('layer').droppable({
            accept: function (drag) { return true; },
            hoverClass: 'hover',
            activeClass: 'active',
            drop: function (event, ui) {
                var client_id = $(ui.helper).text();
                ui.helper.remove();
                ui.draggable.remove();
                add_node_to_layer(client_id, $(this).closest('td').attr('data-layer'));
            },
        });
    };
    var nn = {
        layers: [
            [
                [1.0, 1.0, 0.0],
                [0.0, 1.0, 1.0],
            ],
            [
                [1.0],
                [-2.0],
                [1.0],
            ],
            [
                [1.0],
            ],
        ],
        cases: [
            {input: [0, 0], output: [0]},
            {input: [0, 1], output: [1]},
            {input: [1, 0], output: [1]},
            {input: [1, 1], output: [0]},
        ],
    };

    for (var i in nn.layers) {
        add_layer();
    }
    $('.input').click(function () {
        var id = Math.floor(Math.random() * 10000);
        $('.clients td').first().find('.node').each(function () {
            socket.emit('nn_input', {receiver: $(this).attr('data-client'), value: {value: parseFloat(prompt('input plz')), id: id}});
        });
    });
});
