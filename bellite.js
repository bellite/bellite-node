/*-*- coding: utf-8 -*- vim: set ts=4 sw=4 expandtab
##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##
##~ Copyright (C) 2002-2013 Bellite.io                            ##
##~                                                               ##
##~ This library is free software; you can redistribute it        ##
##~ and/or modify it under the terms of the MIT style License as  ##
##~ found in the LICENSE file included with this distribution.    ##
##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##*/

"use strict";
var net = require('net'),
    util = require('util'),
    events = require('events'),
    deferred = require('fate').deferred;

exports.Bellite = Bellite;
function Bellite(cred, logging) {
    if (!(this instanceof Bellite))
        return new Bellite(cred, logging);

    events.EventEmitter.call(this);
    this._resultMap = {};
    this._logging = logging ? true : (logging!=null ? false : null);

    cred = this.findCredentials(cred);
    if (cred==null)
        throw new Error("Invalid Bellite credentials");

    var f_ready = deferred();
    this.ready = f_ready.promise;
    this.on('connect', function(){ this.on_connect(cred, f_ready) })
    this._connect_jsonrpc(cred, f_ready);
    return this;
}
util.inherits(Bellite, events.EventEmitter);

Bellite.prototype._connect_jsonrpc = function(cred, f_ready) {
    var self=this, connBuf='', conn = net.connect(cred);
    conn.setEncoding("UTF-8");

    conn.on('error', function(err) {
        if (self._logging!==false)
            console.warn('Error connecting to Bellite server', cred, err, self._logging)
        f_ready.reject(err);
        conn.destroySoon();
        self.emit('conn_error', err) })
    conn.on('connect', function() {
        try { conn.setNoDelay(true); conn.setKeepAlive(true, 0)
        } catch (err) {} // make sure Windows XP doesn't complain
        self.emit('connect') });
    conn.on('data', function(data) {
        data = (connBuf+data).split('\0')
        connBuf = data.pop()
        self._recvJsonRpc(data) });
    conn.on('close', function() {
        conn = null; self.emit('close') })
    self._sendMessage = function sendMessage(msg) {
        return conn!==null ? (conn.write(msg+'\0'), true) : false }
    self._shutdown = function() { conn.end() }
    return conn;
}
Bellite.prototype.findCredentials = function(cred) {
    if (cred==null) {
        cred = process.env.BELLITE_SERVER;
        if (!cred) {
            cred = '127.0.0.1:3099/bellite-demo-host';
            if (this._logging!==false)
                console.warn('BELLITE_SERVER environment variable not found, using "'+cred+'"', this._logging)
        }
    } else if (cred.split===undefined)
        return cred;
    var res={credentials:cred};
    cred = cred.split('/',2);
    if (cred.length<=1)
        return null;
    res.token = cred[1];
    cred = cred[0].split(':',2);
    res.host = cred[0];
    res.port = parseInt(cred[1]);
    return res;
}

Bellite.prototype.logSend = function (msg) {
    if (this._logging) console.log('send ==> ', JSON.stringify(msg))}
Bellite.prototype.logRecv = function (msg) {
    if (this._logging) console.log('recv <== ', JSON.stringify(msg))}

Bellite.prototype._sendJsonRpc = function sendJsonRpc(method, params, id) {
    var msg = {jsonrpc: "2.0", id:id, method:method, params:params}
    this.logSend(msg);
    return this._sendMessage(JSON.stringify(msg)) }
Bellite.prototype._recvJsonRpc = function recvJsonRpc(msgList) {
    while (msgList.length) {
        var msg = msgList.shift();
        try { msg = JSON.parse(msg) }
        catch (err) { this.on_rpc_error(err, msg); continue }
        this.logRecv(msg);
        if (msg.method!==undefined)
            this.on_rpc_call(msg)
        else this.on_rpc_response(msg)
    } }
Bellite.prototype.on_rpc_error = function(err, msg) {
    console.error("Bellite JSON-RPC error: ", err) }
Bellite.prototype.on_rpc_response = function(msg) {
    var tgt=this._resultMap[msg.id];
    delete this._resultMap[msg.id];
    if (tgt===undefined) return
    if (msg.error!==undefined)
        tgt.reject(msg.error)
    else if (msg.result[0])
        tgt.reject(msg.result)
    else
        tgt.resolve(msg.result) }
Bellite.prototype.on_rpc_call = function(msg) {
    var args=msg.params;
    if (msg.method==='event')
        this.emit(args.evtType, args) }

Bellite.prototype._nextId = 100;
Bellite.prototype._invoke = function(method, params) {
    var id = this._nextId++,
        res = deferred(this);
    res.method = method;
    this._resultMap[id] = res;
    if (!this._sendJsonRpc(method, params, id))
        res.reject(new Error('Bellite client not connected'))
    return res.promise }

Bellite.prototype.close = function() {
    return this._shutdown() }
Bellite.prototype.auth = function(token) {
    return this._invoke('auth', [token]) }
Bellite.prototype.version = function() {
    return this._invoke('version') }
Bellite.prototype.ping = function() {
    return this._invoke('ping') }
Bellite.prototype.respondsTo = function(selfId, cmd) {
    if (!selfId) selfId = 0;
    return this._invoke('respondsTo', [selfId, cmd||""]) }
Bellite.prototype.perform = function(selfId, cmd, args) {
    if (!selfId) selfId = 0;
    return this._invoke('perform', [selfId, cmd||"", args]) }
Bellite.prototype.bindEvent = function(selfId, evtType, res, ctx) {
    if (!selfId) selfId = 0;
    if (evtType===undefined) evtType = null;
    if (res===undefined) res = -1;
    return this._invoke('bindEvent', [selfId, evtType, res, ctx]) }
Bellite.prototype.unbindEvent = function(selfId, evtType) {
    if (!selfId) selfId = 0;
    if (evtType===undefined) evtType = null;
    return this._invoke('unbindEvent', [selfId, evtType]) }

Bellite.prototype.on_connect = function(cred, f_ready) {
    this.auth(cred.token)
        .then(f_ready.resolve, f_ready.reject)
        .then(this.on_auth_succeeded, this.on_auth_failed) }
Bellite.prototype.on_auth_succeeded = function(msg) {
    this.emit('auth', true, msg)
    this.emit('ready', msg) }
Bellite.prototype.on_auth_failed = function(msg) {
    this.emit('auth', false, msg) }

