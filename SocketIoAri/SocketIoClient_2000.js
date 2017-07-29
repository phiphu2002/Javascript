#!/usr/bin/env nodejs

var io = require('socket.io-client');
var client = io.connect('http://192.168.1.9:8089');
var msg = '2000';
client.emit('extension', msg);
client.on('callerid', function(data){
    console.log(data);
});
