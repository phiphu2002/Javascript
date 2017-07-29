#!/usr/bin/env nodejs

//Author: PhiPhu
//This application is a Socket.io server running on Node.js.
//HOW IT WORKS
//First, an user logins via Browser
//The Socket.io client will:
// - get SIP extension number of the logedin user
// - connect to the Socket.io server
// - send SIP exten to the server
//The Socket.io server will:
// - receive SIP exten
// - create an ARI client
// - pass the SIP extension number to the ARI client 
//The ARI client will:
// - create a websocket to ARI server, asterisk
// - via ARI API, create an event and link it to a Stasis appliation, which is equivalent to the SIP extension number, on asterisk 
// - when there is an incomming call to the SIP exten, Stasis app will return data via websocket
// - parse to get CallerId from return data, in json format, of the ARI API
// - force the SIP channel continue dialing the SIP endpoint
// - pass the CallerId to the Socket.io server
//Last, Socket.io client will lookup related information, from the CallerId, in Database  
 
var server = require('socket.io')();
var util = require('util');
var ari_client = require('ari-client');
var SOCKETIO_SERVER_PORT = 8089
var ARI_URL = 'http://192.168.1.9:8088/ari';
var ARI_USER = 'asterisk';
var ARI_PASS = 'asterisk';
 
server.on('connection', function(socket){
    socket.on('extension', function(data){
        var exten = '0000';
        var caller_id = '0000';
        console.log('Socket.io client connects');
        console.log('SIP extension number is %s', data);
        exten = data;
        ari_client.connect(ARI_URL, ARI_USER, ARI_PASS, function(err, ari){ 
            if (err) {
                throw err;
            }
            function stasisStart(event, channel) {
                console.log(util.format('Channel %s has entered the application', channel.name));
                Object.keys(event.channel).forEach(function(key) {
                    if (key == 'caller'){
                        caller_id = channel[key]['number']; 
                        console.log(util.format('CallerId: %s', caller_id));
                        socket.emit('callerid', caller_id);//Response CallerId to Socket.io client
                    }
                });
                ari.channels.continueInDialplan({channelId: channel['id']},function (err) {});
                //console.log(util.format('%s: %s', key, JSON.stringify(channel[key])));
            }
            function stasisEnd(event, channel) {
                console.log(util.format('Channel %s has left the application', channel.name));
            }
            ari.on('StasisStart', stasisStart);
            ari.on('StasisEnd', stasisEnd);
            ari.start(exten);
        });
    });
    socket.on('disconnect', function(){
        console.log('Socket.io client disconnects');
    });
});
server.listen(SOCKETIO_SERVER_PORT);
