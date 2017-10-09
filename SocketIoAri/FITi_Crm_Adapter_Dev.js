var socketIo203;

$(document).ready(function () {
    var SOCKETIO_SERVER = 'http://192.168.100.18:8090';
    var RECONECT_TIME = 1000;
    var text = $("a[href='/Account/ChangeSip']").text();//text = 'phu (2000)'
    var start = text.search('\\(');
    var end = text.search('\\)');
    var myExten = text.slice(start + 1, end);
    console.log(myExten);
    socketIo203 = io203(SOCKETIO_SERVER);
    var $div = $('div.onepas012017');
    var popupHtml = "<div class='onepas012017-popup' state='Down'> \
	                    <div> \
                    	    <b class='onepas012017' name='btnClose'>X</b> \
							<textarea class='onepas012017' rows='1' style='height: 25px;' name='txtPhone' style='font-weight:bold;cursor:pointer;' readonly></textarea> \
							<textarea class='onepas012017' rows='1' style='height: 25px;' name='txtName' readonly></textarea> \
							<textarea class='onepas012017' rows='5' style='height: 80px;' name='txtLastBooking' readonly></textarea> \
							<textarea class='onepas012017' rows='5' style='height: 80px;' name='txtGhiChu' placeholder='Comment'></textarea> \
						</div> \
						<div> \
							<button id='btnSave' name='btnSave' class='onepas012017'>Cập nhật</button> \
						</div> \
					</div>";
    var CALLERID_STATE_DATA = {'callerId':null, 'state':null, 'data':null, 'inboundChannelId':null};
	var POPUP_LIST = [];//List of Popup, which are displaying on screen.
	
    function reconnect(socket) {
        socket.connect();
    }
	
    function addLogCaller(callerId, sdt, batDau, ketThuc, ghiChu) {
        var formData = new FormData();
        formData.append("callerId", callerId);
        formData.append("sdt", sdt.replaceAll('.', ''));
        formData.append("batDau", batDau);
        $.ajax({
            type: "POST",
            url: '/OnepasReverse/AddLogCaller',
            data: formData,
            dataType: 'json',
            contentType: false,
            processData: false,
            success: function (data) {
                editLogCaller(callerId, ketThuc, ghiChu);
            },
            error: function (request, status, error) {
                showAlert('Lỗi không thể kết nối đến máy chủ.');
            }
        });
    }

    function editLogCaller(callerId, ketThuc, ghiChu) {
        var formData = new FormData();
        formData.append("callerId", callerId);
        formData.append("ketThuc", ketThuc);
	    formData.append("answered", true);
        formData.append("ghiChu", ghiChu);
        $.ajax({
            type: "POST",
            url: '/OnepasReverse/EditLogCaller',
            data: formData,
            dataType: 'json',
            contentType: false,
            processData: false,
            success: function (data) {
		        showAlert('Cập nhật dữ liệu thành công.');
            },
            error: function () {
                showAlert('Lỗi không thể kết nối đến máy chủ.');
            }
        });
    }
    
    function getBookingState(code) {
        var state = "";
        switch (code) {
            case 1:
                state = "Chờ xác nhận";
                break;
            case 2: 
                state + "Đang xác nhận";
                break;
            case 3: 
                state = "Chờ chuyển khách";
                break;
            case 4: 
                state = "Đang chuyển khách";
                break;
            case 5: 
                state = "Chờ chăm sóc";
                break;
            case 6: 
                state = "Đang chăm sóc";
                break;
            case 7: 
                state = "Đã chăm sóc";
                break;
            case 20:
                state = "Hủy";
                break;
        }
        return state;
    }
	function fadeOutPopup($popup, $div){
		var phoneNumber = $popup.find("textarea[name='txtPhone']").text();
		var index = POPUP_LIST.indexOf(phoneNumber);
		if (index != -1){
			POPUP_LIST.splice(index, 1);
			$div.children().eq(index).remove();
		}
	}
	//This function layouts popups on screen
	//style = 0; overlapped popups
	//style = 1; mosaic popups
	MAX_ZINDEX = 99999;
	GAP_UNIT = 6;
    function fadeInPopup(style, $popup, $div){
		var phoneNumber = $popup.find("textarea[name='txtPhone']").text();
		var index = POPUP_LIST.indexOf(phoneNumber);
		$popup.css('zIndex', MAX_ZINDEX + index*GAP_UNIT);
		$popup.attr('state', 'Ringing');
		var top = $popup.css('top').replace(/\D/g,'');
		$popup.css('top', parseInt(top) + index*GAP_UNIT*2);
		var left = $popup.css('left').replace(/\D/g,'');
		$popup.css('left', parseInt(left) + index*GAP_UNIT*2);
		$popup.fadeIn();
	}
    function displayData() {
        var newState = 'Down';
        var isMyExtenFound = false;
		var $popup;
		
		var index = POPUP_LIST.indexOf(CALLERID_STATE_DATA['callerId']);
		if (index == -1){
			var currentHtml = $div.html();
		    $div.append(popupHtml);
		    $popup = $div.children().last();
			POPUP_LIST.push(CALLERID_STATE_DATA['callerId']);
		}else{
			$popup = $div.children().eq(index);
		}
        for (var i = 0; i < CALLERID_STATE_DATA['state'].length; i++) {
            if (CALLERID_STATE_DATA['state'][i]['exten'] == myExten) {
                newState = CALLERID_STATE_DATA['state'][i]['outboundChannelState'];
                isMyExtenFound = true;
            }
        }
		console.log(CALLERID_STATE_DATA);
        console.log('currentState: ' + $popup.attr('state') + ' - newState: ' + newState);
        if ($popup.attr('state') == 'Down' && newState == 'Ringing') {
            var lastBookingData = CALLERID_STATE_DATA['data']['lastBooking'];
            var totalBookingTimesData = CALLERID_STATE_DATA['data']['totalBookingTimes'];
            var totalCancelingTimesData = CALLERID_STATE_DATA['data']['totalCancelingTimes'];
            $popup.draggable();
            $popup.find("button[name='btnSave']").attr('disabled', 'disabled');
            $popup.find("textarea[name='txtPhone']").text(CALLERID_STATE_DATA['callerId']);
            $popup.find("textarea[name='txtName']").text(CALLERID_STATE_DATA['data']['name']);
            $popup.find("textarea[name='txtLastBooking']").text('Lần đặt gần nhất:\n' + 
                                                                 lastBookingData['info'] + ' .' + lastBookingData['state'] + '\n' +
                                                                 'Tổng số lần đặt:' +
                                                                 totalBookingTimesData['info'] + '\n'
                                                                );
            $popup.find("textarea[name='txtPhone']").click(function (e) {
                $popup.find("textarea[name='txtPhone']").select();
                document.execCommand('copy');
            });
            $popup.find("b[name='btnClose']").click(function (e) {
				fadeOutPopup($popup, $div);
                e.preventDefault();
            });
            $popup.find("button[name='btnSave']").click(function (e) {
                var callerId = CALLERID_STATE_DATA["inboundChannelId"];
                var duration = CALLERID_STATE_DATA["duration"];
                var sdt = $popup.find("textarea[name='txtPhone']").val();
                var batDau = duration['start'];
                var ketThuc = duration['end'];
                var ghiChu = $popup.find("textarea[name='txtGhiChu']").val();
                addLogCaller(callerId, sdt, batDau, ketThuc, ghiChu);
				fadeOutPopup($popup, $div);
            });
			fadeInPopup(0, $popup, $div);//Popup displaying point
        }
        if ($popup.attr('state') == 'Ringing' && newState == 'Up') {
			$popup.attr('state', 'Up');
        }
        if (isMyExtenFound == false) {//TODO: why this code block
            if (CALLERID_STATE_DATA['state'].length != 0) {
				fadeOutPopup($popup, $div);
            } else {
                $popup.find("button[name='btnSave']").removeAttr('disabled');
            }
        }
    }
	//Thông tin số lần đặt chỗ gần nhất của người dùng.
    function getLastBooking(phone) {
        var lastBookingData = { 'info': null, 'state': null };
        var totalBookingTimesData = { 'info': null, 'linkDetails': null };
        var totalCancelingTimesData = { 'info': null };
        var bookingData = { 'phone': null, 'name': null, 'lastBooking': lastBookingData, 'totalBookingTimes': totalBookingTimesData, 'totalCancelingTimes': totalCancelingTimesData };
		httpGet("/OnepasReverse/GetDatChoGanNhatBySdt", { sdt: phone }).then(function (data) {
			var strContent = "";
			if (data.SoDienThoai) {
				var lengthReserve = data.lstDatCho.length;
				var strContent = "SĐT: " + data.SoDienThoai + "\nTên người dùng: " + data.TenNguoiDung + "\nTổng số lần đặt: " + data.TongSoDatCho + "\n";
				bookingData['phone'] = data.SoDienThoai;
				bookingData['name'] = data.TenNguoiDung;
				totalBookingTimesData["info"] = data.TongSoDatCho
				totalCancelingTimesData["info"] = data.TongSoHuy;
				bookingData['totalBookingTimes'] = totalBookingTimesData;
				if (lengthReserve == 0) {
					strContent = strContent + "";
				} else {
					if (lengthReserve > 0) {
						strContent = strContent + " Lần đặt gần nhất:" + "\n";
						var item = data.lstDatCho[1];
						strContent = strContent + "- " + item.ThoiGianDen + " | " + item.TenDoiTac;
						lastBookingData["info"] = item.ThoiGianDen + ", " + item.TenDoiTac;
						lastBookingData["state"] = getBookingState(item.TrangThai);
						bookingData['lastBooking'] = lastBookingData;
					}
				}
			} else {
				strContent = "";
			}
			CALLERID_STATE_DATA['data'] = bookingData;
			displayData();
		});
    }
	function collectData() {
        if (CALLERID_STATE_DATA['callerId'].length > 0) {
            var phoneNumber = CALLERID_STATE_DATA['callerId'];
            phoneNumber = phoneNumber.replace(/\D/g,'');
            getLastBooking(phoneNumber);
        }
    }
    socketIo203.on('connect', function (data) {
        socketIo203.emit('EXTEN', { 'exten': myExten, 'secretKey': 'onepas012017' });
        $("a[href='/Account/ChangeSip']").css({'color':'green', 'font-weight':'bold'});
    });
    socketIo203.on('disconnect', function (data) {
        $("a[href='/Account/ChangeSip']").css({ 'color': 'red', 'font-weight': 'bold' });
        //setTimeout(reconnect, RECONECT_TIME, socketIo203);
    });
    var PING_INTERVAL = 100;
    socketIo203.on('PING', function (data) {
        socketIo203.emit('PONG', myExten);
        //console.log('send PONG');
    });
    socketIo203.on('CALLERID_STATE_DATA', function (data) {
        CALLERID_STATE_DATA['callerId'] = data['callerId'];
        //CALLERID_STATE_DATA['callerId'] = '84977225615';
        CALLERID_STATE_DATA['state'] = data['state'];
        CALLERID_STATE_DATA['data'] = data['data'];
        CALLERID_STATE_DATA['inboundChannelId'] = data['inboundChannelId'];
        CALLERID_STATE_DATA['duration'] = data['duration'];
        collectData();
    });
});
$(window).unload(function () {
    socketIo203.disconnect();
    console.log('window.unload');
});