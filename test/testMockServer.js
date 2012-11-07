"use strict";
function createMockBelliteServer(ns) {
    var self = {
        server: require('net').createServer(),
        token: require('crypto').randomBytes(8).toString('hex') }
    self.server.on('listening', function () {
        var addr = this.address()
        self.env = addr.address+':'+addr.port+'/'+self.token
        process.env.BELLITE_SERVER = self.env
        ns.listening(self);
    })

    self.server.on('connection', function (conn) {
        conn.setEncoding("UTF-8");
        conn.setNoDelay(true);
        conn.setKeepAlive(true, 0);

        var tgt=ns.connect(self, conn, {
            sendMessage: function(msg) {
                return conn.write(msg+'\0') },
            shutdown: function() { return conn.end() },
            send: function(method, params, id) {
                var msg = {jsonrpc: "2.0", id:id, method:method, params:params}
                return this.sendMessage(JSON.stringify(msg)) },
            answer: function(result, id) {
                if (id===undefined) return false;
                var msg = {jsonrpc: "2.0", id:id, result:result}
                return this.sendMessage(JSON.stringify(msg)) },
            error: function(error, id) {
                if (id===undefined) return false;
                var msg = {jsonrpc: "2.0", id:id, error:error}
                return this.sendMessage(JSON.stringify(msg)) },
            authTimeout: setTimeout(function() {
                tgt.shutdown() }, 250)
        });

        var connBuf='';
        conn.on('data', function(data) {
            data = (connBuf+data).split('\0')
            connBuf = data.pop()
            while (data.length) {
                var msg = data.shift();
                try { msg = JSON.parse(msg) }
                catch (err) { tgt.parse_error(err, msg); continue }
                if (msg.method!==undefined)
                    tgt.invoke(msg)
                else tgt.notification(msg)
            } })
        conn.on('close', function() { tgt.conn_close() })
        conn.on('error', function(err) { tgt.conn_error(err) })
    })

    self.server.on('close', ns.server_close)
    self.server.on('error', ns.server_error)

    self.server.listen(0, '127.0.0.1')
    return self;
}

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function testBelliteServer(opt, doneCallback) {
    var allOpenObjs=[], spies = opt.spies;

    function done(err) {
        clearTimeout(done.timeout)
        while(allOpenObjs.length)
            allOpenObjs.shift()()

        process.nextTick(function() {
            doneCallback(err) })
    }

    done.timeout = setTimeout(function() {
        spies.timeout();
        done('timeout')
    }, opt.timeout || 2000)

    function spawn(exec, args) {
        var proc = require('child_process').spawn(exec, args, {stdio:'inherit'})
        proc.on('exit', function(code, signal) {
            spies.subproc_exit(code, signal)
            if (code!==0)
                done('subprocess spawning error', spies);
            else done(null, spies);
        })
    }

    var test ={
        listening: function(test) {
            allOpenObjs.push(function(){test.server.close()})
            try { opt.execClient(spawn)
            } catch (err) { done(err); } },
        server_close: function() {
            spies.server_close()
            done(null, spies) },
        server_error: function(err) {
            spies.server_error(err)
            done(err, spies) },
        connect: function(test, conn, api) {
            allOpenObjs.push(function(){conn.end()})

            var self=Object.create(spies.conn);
            spies.conn.connect()
            self.invoke = function(msg) {
                spies.conn.invoke(msg)
                spies.calls.at(msg.method)(msg.params);
                var fn = impl[msg.method];
                return fn ? fn.call(this, api, msg.params, msg) : null }
            return self },
    }, impl = {
        auth: function(api, args, msg) {
            clearTimeout(api.authTimeout);
            if (args[0] != test.token) {
                api.error({code:401, message:"Unauthorized"}, msg.id)
                api.shutdown()
            } else api.answer([true, "authorized"], msg.id) },
        ping: function(api, args, msg) {
            api.answer([null, true, "pong"], msg.id) },
        version: function(api, args, msg) {
            api.answer([null, {"server":"bellite", "version":"1.4.3", "platform":"node/test"}], msg.id) },
        bindEvent: function(api, args, msg) {
            api.answer([null, true], msg.id) },
        unbindEvent: function(api, args, msg) {
            api.answer([null, true], msg.id) },
        perform: function(api, args, msg) {
            api.answer([null, {'a mock':'result'}], msg.id)
            if (args[1]=='testComplete') {
                api.send('event', {evtType:'testComplete', selfId: 0})
            }
        },
    };

    test = createMockBelliteServer(test) }

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

var vows=require('vows'),
    sinon=require('sinon'),
    assert=require('assert'),

    spies = {
        timeout: sinon.spy(),
        subproc_exit: sinon.spy(),
        server_close: sinon.spy(),
        server_error: sinon.spy(),
        conn: {
            connect: sinon.spy(),
            conn_close: sinon.spy(),
            conn_error: sinon.spy(),
            parse_error: sinon.spy(),
            notification: sinon.spy(),
            invoke: sinon.spy()},
        calls: {
            at: function(key) {
                var spy=this[key];
                if (spy === undefined)
                    this[key] = spy = sinon.spy();
                return spy },
        }};

vows.describe('bellite-node').addBatch({
'the': {
    topic: function() {
        testBelliteServer({
            execClient:runBelliteTest,
            spies:spies, timeout:2000},
            this.callback)
    },
    'mock server': {
        'should finish successfully': function(err) {
            assert.equal(err, null) },
        'should never have socket errors': function() {
            sinon.assert.notCalled(spies.server_error) },
    },
    'test script': {
        'should exit cleanly [0,null]': function() {
            sinon.assert.calledWithExactly(spies.subproc_exit, 0, null) },
        'should complete before timeout': function() {
            sinon.assert.notCalled(spies.timeout) },
        'should connect exactly once': function() {
            sinon.assert.calledOnce(spies.conn.connect) },
        'should never have socket errors': function() {
            sinon.assert.notCalled(spies.conn.conn_error) },
        'should never have parse errors': function() {
            sinon.assert.notCalled(spies.conn.parse_error) },
        'should never send a notification': function() {
            sinon.assert.notCalled(spies.conn.notification) },

        'calls': {
            'auth(token) -- once and only once)': function() {
                sinon.assert.calledOnce(spies.calls.at('auth'))},
            'ping()': function() {
                sinon.assert.called(spies.calls.at('auth'))},
            'version()': function() {
                sinon.assert.called(spies.calls.at('version'))},

            'bindEvent(118, "*")': function() {
                sinon.assert.calledWith(spies.calls.at('bindEvent'),
                    [118, "*", -1, null]) },
            'unbindEvent(118, "*")': function() {
                sinon.assert.calledWith(spies.calls.at('unbindEvent'),
                    [118, "*"]) },

            'bindEvent(119, "appTimer", 2, {"myContext": 2142})': function() {
                sinon.assert.calledWith(spies.calls.at('bindEvent'),
                    [119, "appTimer", 2, {"myContext": 2142}]) },
            'unbindEvent(119, "appTimer")': function() {
                sinon.assert.calledWith(spies.calls.at('unbindEvent'),
                    [119, "appTimer"]) },

            'perform(142, "echo", {"name":[null, true, 42, "value"]})': function() {
                sinon.assert.calledWith(spies.calls.at('perform'),
                    [142, "echo", {"name":[null, true, 42, "value"]}]) },

            'bindEvent(0, "testComplete")': function() {
                sinon.assert.calledWith(spies.calls.at('bindEvent'),
                    [0, "testComplete", -1, null]) },
            'perform(0, "testComplete")': function() {
                sinon.assert.calledWith(spies.calls.at('perform'),
                    [0, "testComplete", null]) },

        }
    },
}}).export(module)

function runBelliteTest(spawn) {
    spawn('node', [__dirname+'/_doBelliteTest.js'])
}
