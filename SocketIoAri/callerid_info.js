var socketIo203;

$(document).ready(function () {
    var SOCKETIO_SERVER = 'http://192.168.100.17:8090';
    var RECONECT_TIME = 1000;
    var text = $("a[href='/Account/ChangeSip']").text();//text = 'phu (2000)'
    var start = text.search('\\(');
    var end = text.search('\\)');
    var myExten = text.slice(start + 1, end);
    console.log(myExten);
    socketIo203 = io203(SOCKETIO_SERVER);
    var myState = 'Down';//State of my SIP outbound channel, Down/Ringing/Up
    var pingsWithoutState = 0;//Number of PINGs received without any Ringing STATE received, caller ON HOOK
    
    var $container = $('div.onepas012017');
    var popupHtml = "<h4>Tiếp nhận yêu cầu khách hàng</h4> \
						<form> \
							<input class='onepas012017' name='txtPhone' value=''> \
							<input class='onepas012017' name='txtName' value='' readonly> \
							<textarea class='onepas012017' rows='5' name='txtLastBooking' value='' readonly></textarea> \
							<textarea class='onepas012017' rows='5' name='txtGhiChu' placeholder='Comment'></textarea> \
						</form> \
						<div> \
							<button id='btnSave' class='onepas012017'>Cập nhật</button> \
							<button id='btnClose' class='onepas012017'>Hủy</button> \
						</div>";
    var CALLERID_STATE_DATA = {'callerId':null, 'state':null, 'data':null, 'inboundChannelId':null};
    function reconnect(socket) {
        socket.connect();
    }

    function collectData() {
        var returnValue = 0;

        if (CALLERID_STATE_DATA['callerId'].length > 0) {
            var profits = CALLERID_STATE_DATA['callerId'];
            profits = profits.replaceAll('.', '');
            profits = profits.replace('+84', '0');
            var isNotNumber = isNaN(profits);
            if (!isNotNumber) {
                if (profits.length > 2) {
                    var beginNumber = profits.substring(0, 2);
                    if (beginNumber == "01") {

                        if (profits.length == 11) {//Lấy thông tin đặt chỗ gần nhất.

                            getLastBooking(profits);

                        } else if (profits.length > 11) {

                            profits = profits.substring(0, profits.length - 1);
                            showAlert("Số điện thoại không thể nhiều hơn 11 số.");
                            returnValue = 1;
                        } else {
                            getLastBooking("");
                            returnValue = 2;
                        }

                    } else if (beginNumber == "08" || beginNumber == "09") {

                        if (profits.length == 10) {//Lấy thông tin đặt chỗ gần nhất

                            getLastBooking(profits);

                        } else if (profits.length > 10) {

                            profits = profits.substring(0, profits.length - 1);
                            showAlert("Số điện thoại không thể nhiều hơn 10 số.");
                            returnValue = 1;
                        } else {
                            getLastBooking("");
                            returnValue = 2;
                        }
                    } else {// trường hợp là các sdt máy bàn
                        if (profits.length >= 8 && profits.length <= 11) {//Lấy thông tin đặt chỗ gần nhất
                            getLastBooking(profits);
                        } else {
                            if (profits.length > 11) {
                                profits = profits.substring(0, profits.length - 1);
                                showAlert("Số điện thoại của bạn không đúng định dạng");
                                returnValue = 1;
                            } else {
                                getLastBooking("");
                                returnValue = 2;
                            }
                        }

                    }
                } else {
                    getLastBooking("");
                }
            }
            else {
                getLastBooking("");
                showAlert("Số điện thoại của bạn không đúng.");
                returnValue = 1;
            }
            //displayData();
            return returnValue;
        }
    }

    //Thông tin số lần đặt chỗ gần nhất của người dùng.
    function getLastBooking(phone) {
        var lastBookingData = { 'info': null, 'state': null };
        var totalBookingTimesData = { 'info': null, 'linkDetails': null };
        var totalCancelingTimesData = { 'info': null };
        var bookingData = { 'phone': null, 'name': null, 'lastBooking': lastBookingData, 'totalBookingTimes': totalBookingTimesData, 'totalCancelingTimes': totalCancelingTimesData };

        if (phone.length > 0) {

            httpGet("/OnepasReverse/GetDatChoGanNhatBySdt", { sdt: phone }).then(function (data) {
                var strContent = "";
                if (data.SoDienThoai) {
                    var lengthReserve = data.lstDatCho.length;
                    var strContent = "SĐT: " + data.SoDienThoai + "\nTên người dùng: " + data.TenNguoiDung + "\nTổng số lần đặt: " + data.TongSoDatCho + "\n";
                    bookingData['phone'] = data.SoDienThoai;
                    bookingData['name'] = data.TenNguoiDung;
                    totalBookingTimesData["info"] = data.TongSoDatCho
                    bookingData['totalBookingTimes'] = totalBookingTimesData;

                    if (lengthReserve == 0) {
                        strContent = strContent + "";
                    } else {
                        if (lengthReserve > 0) {
                            strContent = strContent + " Lần đặt gần nhất:" + "\n";
                            var item = data.lstDatCho[1];
                            strContent = strContent + "- " + item.ThoiGianDen + " | " + item.TenDoiTac;
                            lastBookingData["info"] = item.ThoiGianDen + ", " + item.TenDoiTac;
                            lastBookingData["state"] = "Chờ xác nhận";
                            bookingData['lastBooking'] = lastBookingData;
                        }
                        //strContent = strContent + lengthReserve + " Lần đặt gần nhất:" + "\n";
                        //for (var i = 0; i < lengthReserve; i++) {
                        //    var item = data.lstDatCho[i];
                        //    strContent = strContent + "- " + item.ThoiGianDen + " | " + item.TenDoiTac + "\n"
                        //}
                    }
                } else {
                    strContent = "";
                }
				CALLERID_STATE_DATA['data'] = bookingData;
                displayData();
            });
        } else {
            //$("#txtLastBooking").val("");
            CALLERID_STATE_DATA['data'] = bookingData;
        }
    }

    $("#btnSave").click(function (e) {
        var callerId = CALLERID_STATE_DATA["outboundChannelId"];
        AddLogCaller(callerId);
        e.preventDefault();
    });

    $("#btnHuy").click(function (e) {
        $container.fadeOut();
        e.preventDefault();
    });

    function AddLogCaller(callerId) {
        var sdt = $("#txtPhone").val();
        var name = $("#txtName").val();
        var batDau = '';//$("#txtBatDau").val();
        var ghiChu = $("#txtGhiChu").val();

        var formData = new FormData();
        formData.append("callerId", callerId);
        formData.append("sdt", sdt.replaceAll('.', ''));
        formData.append("batDau", batDau);
        formData.append("ketThuc", batDau);
        formData.append("ghiChu", ghiChu);
        $.ajax({
            type: "POST",
            url: '/OnepasReverse/InsertLogCaller',
            data: formData,
            dataType: 'json',
            contentType: false,
            processData: false,
            success: function (data) {
                if (data.Num > 0) {
                    //
                } else
                    showAlert(data.Message);
            },
            error: function () {
                showAlert('Lỗi không thể kết nối đến máy chủ.');
            }
        });
    }

    function displayData() {
        var newState = 'Down';
        var isMyExtenFound = false;
        console.log(CALLERID_STATE_DATA);
        for (var i = 0; i < CALLERID_STATE_DATA['state'].length; i++) {
            if (CALLERID_STATE_DATA['state'][i]['exten'] == myExten) {
                newState = CALLERID_STATE_DATA['state'][i]['outboundChannelState'];
                isMyExtenFound = true;
                pingsWithoutState = 0;
            }
        }
        console.log('myState: ' + myState + ' - newState: ' + newState);
        if (myState == 'Down' && newState == 'Ringing') {
            myState = 'Ringing';
            $container.html(popupHtml);
            $container.draggable();
            $container.resizable();
            $container.css('zIndex', 9999);
            //$("input#txtPhone").val(CALLERID_STATE_DATA['data']['phone']);
            //$("input#txtName").val(CALLERID_STATE_DATA['data']['name']);
            //$("textarea#txtLastBooking").html(CALLERID_STATE_DATA['data']['lastBooking']);
            var lastBookingData = CALLERID_STATE_DATA['data']['lastBooking'];
            var totalBookingTimesData = CALLERID_STATE_DATA['data']['totalBookingTimes'];
            var totalCancelingTimesData = CALLERID_STATE_DATA['data']['totalCancelingTimes'];
            $("input[class='onepas012017'][name='txtPhone']").val(CALLERID_STATE_DATA['data']['phone']);
            $("input[class='onepas012017'][name='txtName']").val(CALLERID_STATE_DATA['data']['name']);
            $("textarea[class='onepas012017'][name='txtLastBooking']").text('Lần đặt gần nhất:\n' + 
                                                                            lastBookingData['info'] + ' .' + lastBookingData['state'] + '\n' +
                                                                            'Tổng số lần đặt:' +
                                                                            totalBookingTimesData['info'] + '\n'
                                                                            );
            $container.fadeToggle();//Popup triggering point
            $('button.onepas012017').click(function () {
                $container.fadeOut();
                myState = 'Down';
            });
            $(document).mouseup(function (e) {
                if (!$container.is(e.target) // if the target of the click isn't the container...
                    && $container.has(e.target).length === 0) // ... nor a descendant of the container
                {
                    //container.fadeOut();
                }
            });
        }
        if (myState == 'Ringing' && newState == 'Up') {
            myState = 'Up';
        }
        if (isMyExtenFound == false) {
            //console.log('$container.fadeOut();');
            $container.fadeOut();
            myState = 'Down';
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
        console.log(data['state']);
        CALLERID_STATE_DATA['callerId'] = data['callerId'];
        CALLERID_STATE_DATA['callerId'] = '84977225615';
        CALLERID_STATE_DATA['state'] = data['state'];
        CALLERID_STATE_DATA['data'] = data['data'];
        CALLERID_STATE_DATA['inboundChannelId'] = data['inboundChannelId'];
        collectData();
    });
});
$(window).unload(function () {
    socketIo203.disconnect();
    console.log('window.unload');
});