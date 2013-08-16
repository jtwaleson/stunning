var pairings = {};
var clients = {};
var sequence = 0;
$(function () {
    var add_client = function (id) {
        if (!(id in clients)) {
            var found = false;
            $('.layer').each(function () {
                if ((!found) && $(this).find('.node').length < $(this).data('count')) {
                    add_node_to_layer(id, $(this).attr('data-layer'));
                    found = true;
                }
            });
            if (!found) {
                $('<li>').text(id).appendTo('.idle-clients').draggable({revert: true, helper: 'clone'});
            }
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
        var recipient = null;
        if (data.sender === pairing.offerer.id) {
            recipient = pairing.answerer.id;
        } else {
            recipient = pairing.offerer.id;
        }
        socket.emit('add_ice', {recipient: recipient, candidate: data.candidate, pairing_id: pairing.id});
    });
    socket.on('created_offer', function (data) {
        var pairing = pairings[data.pairing_id];
        pairing.offerer.sdp = data.sdp;
        socket.emit('create_response', {recipient: pairing.answerer.id, offer: pairing.offerer.sdp, pairing_id: pairing.id});
    });
    socket.on('created_response', function (data) {
        var pairing = pairings[data.pairing_id];
        pairing.answerer.sdp = data.sdp;
        socket.emit('make_connection', {recipient: pairing.offerer.id, response: pairing.answerer.sdp, pairing_id: pairing.id});
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
            if ($(this).data('client') === client_id) {
                $(this).remove();
            }
        });
    });
    socket.on('nn_output', function (data) {
        $('<div>').text(data.value).appendTo('.output tr[data-sequence=' + data.id + '] td.out');
    });
    var add_node_to_layer = function (client_id, layer) {
        var node_number_in_layer = 0;
        var numbers = {};
        var layer_div = $('.layer[data-layer=' + layer + ']');
        layer_div.find('.node').each(function () {
            numbers[$(this).data('number')] = true;
        });
        while (node_number_in_layer in numbers) {
            node_number_in_layer += 1;
        }
        var identifier = layer + node_number_in_layer;
        $('<div>')
        .addClass('node')
        .data('client', client_id)
        .data('number', node_number_in_layer)
        .text(identifier)
        .appendTo(layer_div);

        var this_layer_weights = nn.layers[layer_div.data('number')];
        var prev_layer_weights = nn.layers[layer_div.data('number') - 1];

        socket.emit('set_identifier', {recipient: client_id, identifier: identifier});
        layer_div.closest('td').prev('td').find('.node').each(function () {
            var pairing = {
                id: window.uuid.v4(),
                offerer: {id: $(this).data('client'), sdp: null},
                answerer: {id: client_id, sdp: null},
            };
            pairings[pairing.id] = pairing;
            var weight = prev_layer_weights[$(this).data('number')][node_number_in_layer];
            socket.emit('create_offer', {recipient: pairing.offerer.id, pairing_id: pairing.id, weight: weight});
        });
        layer_div.closest('td').next('td').find('.node').each(function () {
            var pairing = {
                id: window.uuid.v4(),
                offerer: {id: client_id, sdp: null},
                answerer: {id: $(this).data('client'), sdp: null},
            };
            pairings[pairing.id] = pairing;
            var weight = this_layer_weights[node_number_in_layer][$(this).data('number')];
            socket.emit('create_offer', {recipient: pairing.offerer.id, pairing_id: pairing.id, weight: weight});
        });
    };
    var add_layer = function (count) {
        if (!count) { count = 0; }
        var new_layer_number = $('tr.clients td').length;
        var new_layer_code = String.fromCharCode(new_layer_number + 65);
        $('<th>').appendTo('table.layers thead tr').text(new_layer_code);
        var td = $('<td>').appendTo('tr.clients').append('<div>');
        td.find('div').addClass('layer').attr('data-layer', new_layer_code).data('count', count).data('number', new_layer_number).droppable({
            accept: function (drag) { return true; },
            hoverClass: 'hover',
            activeClass: 'active',
            drop: function (event, ui) {
                var client_id = $(ui.helper).text();
                ui.helper.remove();
                ui.draggable.remove();
                add_node_to_layer(client_id, $(this).attr('data-layer'));
            },
        });
    };
    var nn = {
        layers: [
            [
                [1.0, 0.4, 0.0],
                [0.0, 0.4, 1.0],
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
        add_layer(nn.layers[i].length);
    }
    var nn_execute = function (inputs) {
        var result_tr = $('<tr>').attr('data-sequence', sequence).prependTo('.output');
        var in_td = $('<td>').addClass('in').appendTo(result_tr);
        var out_td = $('<td>').addClass('out').appendTo(result_tr);
        $('<div>').text(JSON.stringify(inputs)).appendTo(in_td);
        $('.layer').first().find('.node').each(function () {
            socket.emit('nn_input', {recipient: $(this).data('client'), value: {value: inputs[$(this).data('number')], id: sequence}});
        });
        sequence += 1;
    };
    $('.input').click(function () {
        var inputs = {};
        $('.layer').first().find('.node').each(function () {
            var value = parseFloat(prompt('input for ' + $(this).text()));
            if (isNaN(value)) { throw "Not a number!"; }
            inputs[$(this).data('number')] = value;
        });
        nn_execute(inputs);
    });
    $('.loop').click(function () {
        var n = parseInt(prompt('how many iterations?'), 10);
        var k = nn.cases.length;
        for (var i = 0; i < n; i++) {
            var j = i % k;
            nn_execute(nn.cases[j].input);
        }
    });
});
