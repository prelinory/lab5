function messageWS_click() {
	const box = document.getElementById("messageWS") ;
	box.style.opacity = 0 ;
}

function messageWS_hide() {
	const box = document.getElementById("messageWS") ;
	const n = box.style.opacity ;
	if (n > 0) {
		box.style.opacity = n - 0.05 ;
		setTimeout( messageWS_hide, 50);
	}
	else {
		box.style.visibility = 'hidden';
		box.style.opacity = 1 ;
	}
}

function messageWS_show( s, autohide = true) {
	const box = document.getElementById("messageWS") ;
	box.innerHTML = s ;
	box.style.opacity = 0 ;
	box.style.visibility = 'visible';
	box.style.opacity = 1 ;
	if (autohide)
		setTimeout( messageWS_hide, 500);
}

function make_text( text) {
    var r = '';
    if (typeof text == "object") {
        for (t of text) {
            if (typeof t == "object") {
                r +=`<a href="${t.href}">${t.text.replace('\n','<br/>')}</a>`
            } else if (typeof t == "string") 
                r += t.replace('\n','<br/>');
            else
                r += t;
        }
    } else if (typeof text == "string") 
        r = text.replace('\n','<br/>');
    else
        r = text;
    return r;
}

function make_photo_thumb( text) {
    const a = text.split('.');
    return a [0] + '_thumb.' + a [1];
}

function make_item( item) {
    return item.photo?
`<div class="message default clearfix joined" id="message${item.id}">
    <div class="body">
        <div class="pull_right date details" title="${item.date}">
            #${item.id} @ ${item.date}
        </div>
        <div class="media_wrap clearfix">
            <a class="photo_wrap clearfix pull_left" href="${item.photo}">
                <img class="photo" src="${make_photo_thumb(item.photo)}" style_="width: ${item.width}px; height: ${item.height}px"/>
            </a>
        </div>
        <div class="text">
            ${make_text(item.text)}
        </div>
    </div>
</div>`:
    item.thumbnail?
`<div class="message default clearfix joined" id="message${item.id}">
    <div class="body">
        <div class="pull_right date details" title="${item.date}">
            #${item.id} @ ${item.date}
        </div>
        <div class="media_wrap clearfix">
            <a class="video_file_wrap clearfix pull_left" href="${item.file}">
                <div class="video_play_bg">
                    <div class="video_play">
                    </div>
                </div>
                <div class="video_duration">
                    00:32
                </div>
                <img class="video_file" src="${item.thumbnail}" style_="width: ${item.width}px; height: ${item.height}px"/>
            </a>
        </div>
        <div class="text">
            ${make_text(item.text)}
        </div>
    </div>
</div>`:
`<div class="message default clearfix joined" id="message26">
    <div class="body">
        <div class="pull_right date details" title="${item.date}">
            #${item.id} @ ${item.date}
        </div>    
    </div>
</div>`;
}

var ws, wsData ;
var handlersByTag = new Map();
var handlersByReq = new Map();
var items_count, orderBy, orderDesc = false, next_req_id = 1 ;

handlersByTag.set('item', (msg) => {
// response, index, item
    const item = msg.item;
    if (!item) {
        messageWS_show(`wrong item message ${msg}`);
        return;
    }
    $(`#item_${msg.index}`)[0].innerHTML = make_item( msg.item);
    if (msg.response)
        handlersByReq.delete( msg.response) ;
});

handlersByTag.set('error', (msg) => {
// response, error_text    
    messageWS_show(`server error : ${msg.error_text}`);
    if (msg.response)
        handlersByReq.delete( msg.response) ;
});

handlersByTag.set('keys', (msg) => {
// response, fields [String]
    let f = fields[0]||"id";
    $(`orderBy_${f}`)[0].checked = true;
    if (msg.response)
        handlersByReq.delete( msg.response) ;
});

handlersByTag.set('info', (msg) => {
// itemsCount, fields [{name, label}, selected[String]]
    var r = '';
    for (f of msg.fields) {
        r += 
`<div>
    <input type="radio" id="orderBy_${f.name}" name="orderBy" value="${f.name}" class="list_fields_input" onclick="set_orderBy('${f.name}');"/>
    <label for="orderBy_${f.name}" class="list_fields_label">${f.label}</label>
</div>`;
    }
    $('#fields_list_insert_point')[0].innerHTML = r;
    $('#orderBy_id')[0].checked = true;
    r = '';
    items_count = msg.itemsCount;
    for (var n = 0; n < items_count ; n ++) 
        r += `<div id="item_${n}">Тут будет сообщение с порядковым номером ${n}...</div>`        
    $('#items_insert_point')[0].innerHTML = r;
    $.ws.send( JSON.stringify({action:"get_all"}));
});

handlersByTag.set('item_keys', (msg) => {
    // response, index, fields[String]    
});

function newRequestID() {
    return next_req_id ++;
}

function log( s) {
    $.ws.send( JSON.stringify({action:"log", message_text: s}));
}

async function item_key( index, sort_id) {
    const id = newRequestID();
    const o = {id: id, handler: (req, data) => {
        req.resolved( data.keys);
        handlersByReq.delete( req.id);
    }};
    const x = new Promise((resolved) => { o.resolved = resolved; });
    handlersByReq.set( id, o);
    $.ws.send( JSON.stringify({action:"item_key", index: index, request: id, sort_id:sort_id}));
    return await x;
}

async function item_swap( index1, index2, sort_id) {
    const id = newRequestID();
    const o = {id: id, handler: (req, data) => {
        req.resolved( true);
        handlersByReq.delete( req.id);
    }};
    const x = new Promise((resolved) => { o.resolved = resolved; });
    handlersByReq.set( id, o);
    $.ws.send( JSON.stringify({action:"swap", indexes: [index1, index2], request: id, sort_id:sort_id}));
    return await x;
}

function compare_keys( l, r) {
    if (typeof l == 'object') {
        if (typeof r != 'object')
            return orderDesc ? -1 : 1;
        for( n = 0; (n < l.length) && (n < r.length) ; n ++){
            if (l [n] != r [n])
                return (l [n] > r [n]) ? (orderDesc ? -1 : 1) : (orderDesc ? 1 : -1) ;
        }
        return (l.length == r.length) ? 0 : ( (l.length > r.length) ? (orderDesc ? -1 : 1) : (orderDesc ? 1 : -1)) ;
    }
    else
        return (l == r) ? 0 : (orderDesc ? ((l > r) ? -1 : 1) : ((l > r) ? 1 : -1)) ;
}

var qsort_id = 1 ;
async function qsort_items( l, r) {
    const id = qsort_id ++ ;
    var i = l;
    var j = r;
    const m = (l + r) >> 1;
    const m_keys = await item_key( m, id);
//    log(`[${id}] qsort(${l},${r}) : m : ${m} : ${JSON.stringify( m_keys)}`);
    do {
        while( (compare_keys( await item_key( i, id), m_keys) < 0) && (i < r)) i ++ ;
        while( (compare_keys( await item_key( j, id), m_keys) > 0) && (j > l)) j -- ;
        if (i < j) 
            await item_swap( i, j, id) ;
        if (i <= j) {
            i ++;
            j --;
        }
    } while( i <= j);
    if (l < j) qsort_items( l, j);
    if (i < r) qsort_items( i, r);
}

async function sort_items() {
    const btn = $('#btn_sort') [0];
    btn.style.opacity = 0.3;
    btn.onclick = null;
    if (items_count > 1)
        await qsort_items(0, items_count - 1);
    btn.onclick = (event) => { sort_items();};
    btn.style.opacity = 1;
}
    
function shuffle_items() {
    const btn = $('#btn_shuffle') [0];
    btn.style.opacity = 0.3;
    btn.onclick = null;

    this_req_id = newRequestID();
    $.ws.send( JSON.stringify({action:"shuffle", request: this_req_id}));

    btn.onclick = (event) => { shuffle_items();};
    btn.style.opacity = 1;
}

function set_orderBy( f) {
    orderBy = f;
    $.ws.send( JSON.stringify({action:"set_keys", request: newRequestID(), keys: [f]}));
}

function wsInit() {
    var s = window.location.origin; 
    s = s.split('://')[1];
    s = s.split('/') [0];
	s = `ws://${s}/`;
	messageWS_show('web socket connecting to '+ s, false);
	let ws = new WebSocket( s);
    $.ws = ws;
	ws.addr = s;
	ws.binaryType = 'arraybuffer';

	ws.onopen = function( e) {
		messageWS_show('WebSocket connected');
	};
	ws.onmessage = function( msg ) {
        const data = JSON.parse( msg.data );
        const req_id = data.response;
        if (req_id) {
            const req = handlersByReq.get( req_id);
            if (req) {
                req.handler( req, data);
                return;
            }
        }
        const handler = handlersByTag.get( data.event);
        if (handler) {
            handler( data);
        } else {
            messageWS_show(`unknown message ${msg.data}`);
        }
	};
	ws.onclose = function( event ) {
		if (event.wasClean) 
            messageWS_show('WS connection is closed...');
		else
            messageWS_show('WS connection is died...');
	};
	ws.onerror = function( error ) {
		messageWS_show('error connecting to '+ ws.addr, false);
		wsInit();
	}
}

function send_message( s) {
    $.ws.send( JSON.stringify({action:"msg", message_text: s}));
}

$("document").ready(() => {
    wsInit();
    $('#btn_sort')[0].onclick = (event) => { sort_items();};
    $('#btn_shuffle')[0].onclick = (event) => { shuffle_items();};
});
/*
a = [1,9,4,2,6,5,0,-2,23,3];

async function test_item_key( index) {
    return a [index];
}

async function test_item_swap( index1, index2) {
  x = a [index1];
  a [index1] = a [index2];
  a [index2] = x;
}

function test_compare_keys( l, r) {
    if (typeof l == 'object') {
        for( n = 0; (n < l.length) && (n < r.length) ; n ++){
            if (l [n] != r [n])
                return (l [n] > r [n]) ? 1 : -1 ;
        }
        return (l.length == r.length) ? 0 : (l.length > r.length) ? 1 : -1 ;
    }
    else
        return (l == r) ? 0 : (l > r) ? 1 : -1 ;
}

async function test_qsort_items( l, r) {
    i = l;
    j = r;
    m = (l + r) >> 1;
    m_keys = await test_item_key( m);
    do {
        while( test_compare_keys( await test_item_key( i), m_keys) < 0) 
            i ++ ;
        while( test_compare_keys( await test_item_key( j), m_keys) > 0) 
            j -- ;
        if (i < j) 
            await test_item_swap( i, j) ;
        if (i <= j) {
            i ++;
            j --;
        }
    } while( i < j);
    if (l < j) 
        await test_qsort_items( l, j);
    if (i < r) 
        await test_qsort_items( i, r);
}

test_qsort_items( 0, a.length -1);
test_a = a;
*/




