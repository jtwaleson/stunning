(function () {
    var page_title = 'Stunning';
    var app, express, http, server, path, uuid, QRCode, cryptico, io, moniker;
    uuid = require('node-uuid');
    express = require('express');
    path = require('path');
    app = express();
    http = require('http');
    server = http.createServer(app);
    io = require('socket.io').listen(server);

    app.configure('development', function () {
        app.set('origin', 'http://192.168.1.121:3000');
    });

    app.configure(function () {
        app.set('port', process.env.PORT || 3000);
        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');
        app.set('authenticator', 'http://jtwaleson.github.io/vault/');
        app.use(express.logger('dev'));
        app.use(express.compress());
        app.use(express.bodyParser());
        app.use(express.static(path.join(__dirname, 'static')));
        app.use(app.router);
        app.use(function (err, req, res, next) {
            console.error(err.stack);
            res.status(500);
            res.render('error', {
                error: err,
                title: 'An error occured'
            });
        });
    });
    app.get('/', function (req, res, next) {
        res.render('index');
    });
    app.get('/master', function (req, res, next) {
        res.render('master');
    });
    app.get('/master/clients', function (req, res, next) {
        var clients = io.sockets.clients('clients');
        for (var i in clients) {
            clients[i] = clients[i].id;
        }
        res.send(clients);
    });
    server.listen(app.get('port'), function () {
        console.log('Express server listening on port ' + app.get('port'));
    });

    io.set('transports', ['websocket', 'xhr-polling']);
    io.set('log level', 2);
    io.sockets.on('connection', function (socket) {
        io.sockets.in('master').emit('new_client', socket.id);
        socket.on('subscribe', function (data) {
            socket.join('clients');
        });
        socket.on('master', function (data) {
            socket.join('master');
        });
        socket.on('ice_candidate', function (data) {
            data.sender = socket.id;
            io.sockets.in('master').emit('ice_candidate', data);
        });
        socket.on('add_ice', function (data) {
            io.sockets.sockets[data.receiver].emit('add_ice', data);
        });
        socket.on('create_response', function (data) {
            io.sockets.sockets[data.receiver].emit('create_response', data);
        });
        socket.on('create_offer', function (data) {
            io.sockets.sockets[data.receiver].emit('create_offer', data);
        });
        socket.on('make_connection', function (data) {
            io.sockets.sockets[data.receiver].emit('make_connection', data);
        });
        socket.on('nn_input', function (data) {
            io.sockets.sockets[data.receiver].emit('nn_input', data.value);
        });
        socket.on('nn_output', function (data) {
            io.sockets.in('master').emit('nn_output', data);
        });
        socket.on('created_offer', function (data) {
            io.sockets.in('master').emit('created_offer', data);
        });
        socket.on('created_response', function (data) {
            io.sockets.in('master').emit('created_response', data);
        });
        socket.on('disconnect', function (data) {
            io.sockets.in('master').emit('client_disconnected', socket.id);
        });
    });
}).call(this);
