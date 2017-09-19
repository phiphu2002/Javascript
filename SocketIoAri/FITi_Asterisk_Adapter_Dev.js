#!/usr/bin/env nodejs

//Author: phiphu@FITi.vn
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
 
//QC passed on:
//Ubuntu 14.04; asterisk/freepbx 13; nodejs v5.12.0; socket.io client 2.0.3

var util = require('util');

var SOCKETIO_SERVER_PORT = 8090
var ARI_URL = 'http://192.168.100.24:8088/ari';
var ARI_USER = 'asterisk';
var ARI_PASS = 'asterisk';
var STASIS_APP_NAME = "onepas012017";//This is: - Stasis application name in extension.conf
                                     //         - and SECRET_KEY to authenticate socket clients

//var SIP_EXTEN = {'exten':null, 'timeoutVar':null, 'socket':null};
var SIP_EXTEN_LIST = [];//List of connected SIP extens; shared by Socket server and ARI client
var PING_INTERVAL = 100;//Interval to send PING to clients
var PING_TIMEOUT = PING_INTERVAL*3;//Max duration from sending PING to receiving PONG

/**
 * This function gets index of a SIP_EXTEN in SIP_EXTEN_LIST by SIP exten
 */
function getIndexFromSipExten(exten){
	for (var i = 0; i < SIP_EXTEN_LIST.length; i++){
		if (SIP_EXTEN_LIST[i]['exten'] == exten){
			return i;
		}
	}
	return -1;
}
/**
 * This function sends PING msg, then prepare to delete SIP exten from SIP_EXTEN_LIST after some delayed time
 */
function ping(socket, exten){
	//debugSipExtenList();
    socket.emit('PING', exten);
    var index = getIndexFromSipExten(exten);
    if (index != -1){
    	if (SIP_EXTEN_LIST[index]['pingCounter'] > PING_TIMEOUT/PING_INTERVAL){//PING timeout
    		removeSipExten(exten);
    		socket.disconnect(true);
    	}else{
    		SIP_EXTEN_LIST[index]['pingCounter']++;
    	}
    }
}
/**
 * This function removes the row contains SIP exten from SIP_EXTEN_LIST
 */
function removeSipExten(exten){
	var index = getIndexFromSipExten(exten);
	if (index != -1){
		SIP_EXTEN_LIST.splice(index, 1);
	}
}
/**
 * This function prints all extens from SIP_EXTEN_LIST
 */
function debugSipExtenList(){
	var extens = [];
	SIP_EXTEN_LIST.forEach(function (SIP_EXTEN, index){
		extens.push(SIP_EXTEN['exten']);
	});
	console.log(extens);
}

/*****************
 * SOCKET SERVER
 * 
 ****************/
var server = require('socket.io')();
server.on('connection', function(socket){
	var g_exten;
	var g_intervalVar;
    socket.on('EXTEN', function(data){//Receive SIP exten
    	var exten = data['exten'];
    	var secretKey = data['secretKey'];
    	if (secretKey != STASIS_APP_NAME){
    		socket.disconnect(true);
    	}else{
	    	var index = getIndexFromSipExten(exten);
	    	var sipExten = {'exten':exten, 'pingCounter':0, 'socket':socket};
	    	g_exten = exten;
	    	if (index == -1){
	    		SIP_EXTEN_LIST.push(sipExten);//Add it to SIP_EXTEN_LIST
	    		g_intervalVar = setInterval(ping, PING_INTERVAL, socket, exten);//Send PING
	    	}else{
	    		//debugSipExtenList();
	    		//TODO: need to solve in case of pingInterval of previous session, of this exten, still runs
	    		//So there are 2 pingIntervals of the same exten
	    	}
	    	debugSipExtenList();
    	}
    });
    socket.on('PONG', function(exten){//Receive PONG
    	var index = getIndexFromSipExten(exten);
    	var sipExten = {'exten':exten, 'pingCounter':0};
    	if (index != -1){
    		SIP_EXTEN_LIST[index]['pingCounter'] = 0;
    	}else{
    		SIP_EXTEN_LIST.push(sipExten);
    	}
    });
    socket.on('DATA', function(data){
    });
    socket.on('disconnect', function() {
    	removeSipExten(g_exten);
		socket.disconnect(true);
		console.log('disconnect');
		clearInterval(g_intervalVar);
     });
    socket.on('CALLERID_STATE_DATA', function(CALLERID_STATE_DATA) {
    	console.log(CALLERID_STATE_DATA);
    	//TODO: instead of broadcast to all connected clients, should multicast to ONLY clients in the groupcall
    	SIP_EXTEN_LIST.forEach(function (SIP_EXTEN, index){
    		SIP_EXTEN['socket'].emit('CALLERID_STATE_DATA', CALLERID_STATE_DATA);
        });
    });
});
server.listen(SOCKETIO_SERVER_PORT);

/*****************
 * ARI CLIENT
 * 
 ****************/
var CALLERID_STATE_DATA_UPDATE_DURATION = 1000;
var MAX_EMITS = 3;//To limit the number of Emit to server
var MAX_EMPTY_RECEIVES = 6;//To limit the empty received states
var ari_client = require('ari-client');//https://github.com/asterisk/node-ari-client
ari_client.connect(ARI_URL, ARI_USER, ARI_PASS, function(err, ari){//Connect to Asterisk ARI
    if (err) {
        throw err;
    }
    function stasisStart(event, channel) {
    	console.log('StasisStart');
		//console.log(channel);
    	var CALLERID_STATE_DATA = {//Each incomming call will have a CALLERID_STATE_DATA, SIP extens in CALLERID_STATE_DATA must be existed in SIP_EXTEN_LIST
			                        "callerId":null,//asterisk caller id
									"state":null,
									"data":null, 
									"inboundChannelId":null,//asterisk inbound channel id
									"duration":{"start":null, "end":null},
									};
        Object.keys(event.channel).forEach(function(key) {
            if (key == 'caller'){
            	CALLERID_STATE_DATA['callerId'] = channel[key]['number'];//Get Caller number of inbound channel
            }
			if (key == 'id'){
				CALLERID_STATE_DATA['inboundChannelId'] = channel[key];
			}
        });
        ari.channels.continueInDialplan({channelId: channel['id']},function (err) {});//Continue ringing SIP oubound channels
        var timeout = setTimeout(updateCalleridStateData, 100, ari, CALLERID_STATE_DATA);
        var timeout = setTimeout(updateCalleridStateData, 300, ari, CALLERID_STATE_DATA);
        var interval = setInterval(updateCalleridStateData, CALLERID_STATE_DATA_UPDATE_DURATION, ari, CALLERID_STATE_DATA);
        var numOfEmits = 0;
        var numOfEmptyReceives = 0;
        function updateCalleridStateData(ari, CALLERID_STATE_DATA){
        	//console.log('updateCalleridStateData()');
        	ari.channels.list(function (err, channels) {//Get current Outbound channel state of connected SIP extens
        		//console.log(channels.length);
        		//console.log(channels);
        		var stateList = [];
        		channels.forEach(function (channel, index){
        			//console.log('channel.name '+channel.name);
        			//console.log('channel.connected.number '+channel.connected.number);
        			//console.log('CALLERID_STATE_DATA.callerId '+CALLERID_STATE_DATA.callerId); 
        			var slashIndex = channel.name.search('/');
        			var minusIndex = channel.name.search('-');//Example of channel.name = 'SIP/3000-00000003'
        			var exten = Number(channel.name.slice(slashIndex+1, minusIndex));
        			//console.log(exten);
        			if (getIndexFromSipExten(exten) != -1 && channel.connected.number == CALLERID_STATE_DATA.callerId){//Find connected SIP extens, rining on the same callerId  
        				var state = {"exten":null, "outboundChannelId":null, "outboundChannelState":null};
        				state.exten = exten;
        				state.outboundChannelId = channel.id;
        				state.outboundChannelState = channel.state;
        				stateList.push(state);
        			}
        		});
        		//console.log(stateList);
        		CALLERID_STATE_DATA.state = stateList;
        	});
        	//console.log(CALLERID_STATE_DATA);
        	if (numOfEmits <= MAX_EMITS ){
        		if (CALLERID_STATE_DATA['state'] != null && CALLERID_STATE_DATA['state'].length != 0){
            		CALLERID_STATE_DATA['state'].forEach(function (state, index){
                		if (state.outboundChannelState == 'Ringing'){
                			if (numOfEmits <= MAX_EMITS - 2){
								var start =  new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/-/, '\/').replace(/-/, '\/');
								CALLERID_STATE_DATA['duration']['start'] = start;
                				client.emit('CALLERID_STATE_DATA', CALLERID_STATE_DATA);
                    			numOfEmits++;
                			}
                		}else if (state.outboundChannelState == 'Up'){
							if (numOfEmits <= MAX_EMITS - 1){
                			    client.emit('CALLERID_STATE_DATA', CALLERID_STATE_DATA);
                			    numOfEmits++;
							}
                		}else{
							//console.log('state: ' + state.outboundChannelState);
						}
                	});
        		}else{
					if (numOfEmits > 2){
						var end =  new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').replace(/-/, '\/').replace(/-/, '\/');
					    CALLERID_STATE_DATA['duration']['end'] = end;
						client.emit('CALLERID_STATE_DATA', CALLERID_STATE_DATA);
                	    numOfEmits++;
					}
        			if (numOfEmptyReceives <= MAX_EMPTY_RECEIVES){
        				numOfEmptyReceives++;
        			}else{
        				numOfEmits = 0;
        				numOfEmptyReceives = 0;
        				clearInterval(interval);
        			}
        		}
        	}else{
        		numOfEmits = 0;
        		numOfEmptyReceives = 0;
        		clearInterval(interval);
        	}
        }
    }
    function stasisEnd(event, channel) {
    	console.log('StasisEnd');
    }
    //Register listenners
    ari.on('StasisStart', stasisStart);
    ari.on('StasisEnd', stasisEnd);
    ari.start(STASIS_APP_NAME);
});
/*****************
 * SOCKET CLIENT
 * 
 ****************/
var io = require('socket.io-client');
var client = io.connect('http://localhost:'+SOCKETIO_SERVER_PORT);
