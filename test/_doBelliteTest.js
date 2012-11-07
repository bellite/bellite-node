/*-*- coding: utf-8 -*- vim: set ts=4 sw=4 expandtab
##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##
##~ Copyright (C) 2002-2012 Bellite.io                            ##
##~                                                               ##
##~ This library is free software; you can redistribute it        ##
##~ and/or modify it under the terms of the MIT style License as  ##
##~ found in the LICENSE file included with this distribution.    ##
##~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~##*/

"use strict";
var bellite=require('../bellite.js'),
    app = bellite.Bellite();

//console.log("testBellite!", process.env.BELLITE_SERVER)
app.on('ready', function() {
    app.ping()
    app.version()

    app.perform(142, "echo", {"name":[null, true, 42, "value"]})

    app.bindEvent(118, "*")
    app.unbindEvent(118, "*")

    app.on('testEvent', function(eobj) {
        if (eobj.evt)
            app.perform(0, eobj.evt)
        else app.close()
    })
    app.bindEvent(0, "testEvent", 42, {'testCtx': true})
    app.perform(0, "testEvent")
})
