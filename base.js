/**
 * MVC framework based Backbone 
 * @description origin app 
 */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['exports', 'underscore', 'backbone'], factory);
    } else if (typeof exports === 'object') {
        // CommonJS
        factory(exports, root._, root.Backbone);
    } else {
        // Browser globals
        factory((root.app = {}), root._, root.Backbone);
    }
}(window, function (exports, _, Backbone) {
    var app = exports;
    var singleton = function() {
        if(!this.__instache) {
            this.__instache = new this();
        }
        return this.__instache;
    };
    /**
     * 添加支持.super函数来调用父层函数
     */
    var extend = function(protoProps, staticProps) {
        var args = _.toArray(arguments);
        var fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
        // backbone deal with constructor unlike other prototype function
        if(_.has(protoProps, 'constructor')) {
            if(fnTest.test(protoProps.constructor)) {
                var constructor = protoProps.constructor;
                protoProps.constructor = function() {
                    var tmp = this._super;
                    this._super = _super.constructor;
                    var ret = constructor.apply(this, arguments);
                    this._super = tmp;
                    return ret;
                };
            }
        }


        var child = Backbone.Model.extend.apply(this, args);
        var prototype = child.prototype;
        var _super = child.__super__;

        for (var name in protoProps) {
            // Check if we're overwriting an existing function
            prototype[name] = typeof protoProps[name] == "function" &&
                typeof _super[name] == "function" && fnTest.test(protoProps[name]) ?
                (function(name, fn) {
                    return function() {
                        var tmp = this._super;

                        // Add a new ._super() method that is the same method
                        // but on the super-class
                        this._super = _super[name];

                        // The method only need to be bound temporarily, so we
                        // remove it when we're done executing
                        var ret = fn.apply(this, arguments);
                        this._super = tmp;

                        return ret;
                    };
                })(name, protoProps[name]) : protoProps[name];
        }

        return child;
    };
    /**
     * 扩展的View类，添加了ajax管理
     */
    app.BaseView = Backbone.View.extend({
        app: app,
        constructor: function() {
            this.ajaxQueue = [];
            Backbone.View.apply(this, arguments);
        },
        ajax: function() {
            var view = this;
            var promise = Backbone.ajax.apply(this, arguments);

            if(!promise.abort) {
                throw new Error('');
            }
            promise.always(function() {
                var queue = view.ajaxQueue;
                var index = queue.indexOf(promise);
                queue.splice(index, 1);
            });
            this.ajaxQueue.push(promise);
            return promise;
        },
        abortAjaxQueue: function() {
            var view = this;
            _.each(view.ajaxQueue, function(promise) {
                if(promise && promise.abort) {
                    promise.abort();
                }
            });
            this.ajaxQueue = [];
        },
        viewWillAddStage: function() {},
        viewWillBeActive: function(callback) {
            callback();
        },
        viewBeActive: function() {
            this.$el.show();
        },
        viewBeInActive: function() {
            this.$el.hide();
        },
        viewWillBeInActive: function(callback) {
            callback();
        },
        viewRemovedStage: function() {},
        destroy: function() {}
    }, {
        singleton: singleton,
        extend: extend
    });

    app.BaseModel = Backbone.Model.extend({
        app: app
    }, {
        singleton: singleton,
        extend: extend
    });

    app.BaseCollection = Backbone.Collection.extend({
        app: app
    }, {
        singleton: singleton,
        extend: extend
    });

    app.MainView = app.BaseView.extend({
        el: document.body
    });

    app.ActionView = app.BaseView.extend({
        onStage: false,
        mainTain: false,
        dispath: function(inActive, callback) {
            callback || (callback = function() {});
            callback();
        }
    });

    app.ControllerView = app.ActionView.extend({
        defaultAction: 'index',
        errorAction: null,
        Actions: function() {
            return {}
        },
        loadAction: function(module, callback) {
            callback(this.Actions[module]);
        },
        prepareAction: function(action, callback) {
            var controller = this;

            if(!action || !(action in this.Actions)) {
                action = this.errorAction || this.defaultAction;
            }
            if(!(action in this.actions)) {
                this.loadAction(action, function(Action) {                
                    var ActionClass = Action.extend({
                        name: action,
                        controller: controller
                    });
                    controller.actions[action] = new ActionClass();
                    controller.actions[action].$el.addClass(action+'Action');

                    callback(controller.actions[action]);
                });
            } else {
                callback(this.actions[action]);
            }
        },
        appendAction: function(activeActionInstance) {
            this.$el.append(activeActionInstance.$el);
        },
        dispath: function(inActive, callback) {
            callback || (callback = function() {});
            var actionName = this.module.router.activeAction;
            var action = this.actions[actionName];

            if(inActive) {
                action.viewWillBeInActive(function() {
                    action.dispath(inActive, function() {
                        action.viewBeInActive();
                        action.viewRemovedStage();
                        action.destroy();
                        callback();
                    });
                });
            } else {
                action.viewWillAddStage();
                this.appendAction(action);
                action.viewWillBeActive(function() {
                    action.viewBeActive(app.params);
                    action.dispath();
                    callback();
                });
            }
        },
        // destroyAction: function(activeAction) {
        //     var controller = this;
        //     _.each(this.actions, function(action, name) {
        //         if(!activeAction || activeAction === name) {
        //             action.abortAjaxQueue();
        //             if(!action.mainTain) {
        //                 var done = function() {
        //                     if(action.onStage) {
        //                         action.onStage = false;
        //                     }
        //                     action.$el.remove();
        //                     action.viewRemovedStage();
        //                     action.destroy();
        //                     delete controller.actions[name];
        //                     if(!_.size(controller.actions)) {
        //                         controller.destroy();
        //                     }
        //                 };
        //                 if(action.viewWillRemoveStage.length > 0) {
        //                     action.viewWillRemoveStage(function() {
        //                         done();
        //                     });
        //                 } else {
        //                     action.viewWillRemoveStage();
        //                     done()
        //                 }
        //             } else {
        //                 action.$el.hide();
        //                 action.viewBeInActive();
        //             }
        //         }
        //     });
        // },
        constructor: function() {
            this.Actions = _.result(this, 'Actions');
            this.actions = {};
            this._super();
        },
        destroy: function() {
            // this.viewWillRemoveStage();
            // this.$el.remove();
            // this.viewRemovedStage();
            // _.map(this.router.controllers, function(controller, name) {
            //     if(controller == this) {
            //         delete this.router.controllers[name];
            //     }
            // }, this);
            // return true;
        }
    });

    app.ModuleView = app.ActionView.extend({
        defaultController: 'index',
        errorController: null,
        // 定义的Controller类
        Controllers: {},
        // controller实例
        controllers: {},
        // 插入controller dom
        appendController: function(activeControllerInstance) {
            this.$el.append(activeControllerInstance.$el);
        },
        // 加载controller类
        loadController: function(controller, callback) {
            throw new Error('loadController is abstract function, override it.');
        },
        // 获取controller类实例
        prepareController: function(controller, callback) {
            var view = this;
            // 判断controller是否命中，不存在使用error或default
            if(!controller || !(controller in view.Controllers)) {
                // 重定义controller
                controller = view.errorController || view.defaultController;
            }

            if(!(controller in view.controllers)) {
                this.loadController(controller, function(Controller) {
                    var ControllerClass = Controller.extend({
                        name: controller,
                        module: view,
                    });

                    var instance = view.controllers[controller] = new ControllerClass;
                    instance.$el.addClass(controller+'Controller');

                    callback(instance);
                });
            } else {
                callback(this.controllers[controller]);
            }
        },
        // 调度
        dispath: function(inActive, callback) {
            callback || (callback = function() {});
            var controllerName = this.router.activeController;
            var controller = this.controllers[controllerName];

            if(inActive) {
                controller.viewWillBeInActive(function() {
                    controller.dispath(inActive, function() {
                        controller.viewBeInActive();
                        controller.viewRemovedStage();
                        controller.destroy();
                        callback();
                    });
                });
            } else {
                if(!controller.onStage) {
                    controller.viewWillAddStage();
                    this.appendController(controller);
                    controller.onStage = true;
                }
                controller.viewWillBeActive(function() {
                    controller.viewBeActive(app.params);
                    controller.dispath();
                    callback();
                });
            }
        },
        constructor: function() {
            this.Controllers = _.result(this, 'Controllers');
            this._super();
        }
    });

    /**
     * router 控制controller行为
     * controller 控制action行为
     */
    app.Router = Backbone.Router.extend({
        app: app,
        routes: {
            ':module/:controller/:action/*params': 'moduleRoute',
            ':module/:controller/:action': 'moduleRoute',
            ':controller/:action/*params': 'controllerRoute',
            ':controller/:action': 'controllerRoute',
            ':controller': 'controllerRoute',
            '': 'controllerRoute',
        },
        // 前一个module
        previousModule: null,
        // 当前module
        activeModule: null,
        // 前一个controller
        previousController: null,
        // 当前controller
        activeController: null,
        // 前一个action
        previousAction: null,
        // 当前action
        activeAction: null,
        // 原始参数
        rawParams: null,
        // 格式化后的参数
        params: null,
        // 所有模块
        modules: {},
        // 默认模块
        defaultModule: 'index',
        // 全局视图
        view: null,
        // 自动加载
        // autoload: function() {
        //     throw new Error('autoload are required!');
        // },
        /**
         * 路由路口
         * @description
         * 由url上取得controller、action
         * -》解析controller是否存在，不存在则使用errorController，若无则defaultController
         */
        controllerRoute: function(controller, action, params) {
            this.moduleRoute(this.defaultModule, controller, action, params);
        },
        moduleRoute: function(moduleName, controller, action, params) {
            var module = this.prepareModule(moduleName);
            if(module.name != moduleName) {
                params = _.compact([action, params]).join('/');
                action = controller;
                controller = moduleName;
            }
            // 开始执行module逻辑
            this.runModule(controller, action, params, module);
        },
        prepareModule: function(moduleName) {
            // 判断module是否存在，不存在使用default
            if(!moduleName || !(moduleName in this.Modules)) {
                moduleName = this.defaultModule;
            }

            if(!this.modules[moduleName]) {
                var ModuleClass = this.Modules[moduleName].extend({
                    name: moduleName,
                    router: this
                });
                this.modules[moduleName] = new ModuleClass();
                this.modules[moduleName].$el.addClass(moduleName+'Module');
            }
            // 返回module
            return this.modules[moduleName];
        },
        // 执行router
        runModule: function(controller, action, params, moduleInstance) {
            var router = this;

            // 通过routerView获取controller实例
            moduleInstance.prepareController(controller, function(controllerInstance) {
                if(controllerInstance.name != controller) {
                    // controller没有命中的情况下，controller和action都是请求参数，合并到params里
                    // 并至空action
                    params = _.compact([controller, action, params]).join('/');
                    action = null;
                }
                // 通过controller获取action实例
                controllerInstance.prepareAction(action, function(actionInstance) {
                    if(actionInstance.name != action) {
                        // action没有命中，action是请求参数，合并到params内
                        params = _.compact([action, params]).join('/');
                    }

                    // 如果module不同则前一个routerView、controller、action全部隐藏
                    if(moduleInstance.name != router.activeModule) {
                        if(router.activeModule) {
                            router.dispath(true);
                        }
                    } else {
                        if(controllerInstance.name != router.activeController) {
                            if(router.activeController) {
                                router.modules[router.activeModule].dispath(true);
                            }
                        } else {
                            if(actionInstance.name != router.activeAction) {
                                if(router.activeAction) {
                                    moduleInstance.controllers[router.activeController].dispath(true);
                                    // controllerInstance.actions[router.activeAction].dispath(true);
                                }
                            }
                        }
                    }
                    // 修改路由信息
                    router.rawParams = params;
                    router.params = router.parseParams(params);
                    router.previousModule = router.activeModule;
                    router.previousController = router.activeController;
                    router.previousAction = router.activeAction;
                    router.activeModule = moduleInstance.name;
                    router.activeController = controllerInstance.name;
                    router.activeAction = actionInstance.name;
                    router.dispath();
                    router.trigger('change');
                });
            });
        },
        appendModule: function(module) {
            this.view.append(module.$el);
        },
        dispath: function(inActive, callback) {
            callback || (callback = function() {});
            var moduleName = this.activeModule;
            var module = this.modules[moduleName];

            if(inActive) {
                module.viewWillBeInActive(function() {
                    module.dispath(inActive, function() {
                        module.viewBeInActive();
                        module.viewRemovedStage();
                        module.destroy();
                        callback();
                    });
                });
            } else {
                module.viewWillAddStage();
                this.appendModule(module);
                module.viewWillBeActive(function() {
                    module.viewBeActive(app.params);
                    module.dispath();
                    callback();
                });
            }
        },
        // 格式化参数
        parseParams: function(rawParams) {
            if(!rawParams) {
                return {};
            }
            // normalize
            rawParams.replace(/\/+/g, '\/');
            // split by /
            rawParams = rawParams.split('/');

            var keys = _.reject(rawParams, function(value, key){ return key % 2 == 1; });
            var values = _.reject(rawParams, function(value, key){ return key % 2 == 0; });

            return _.object(keys, values);
        },
        initialize: function(options) {
            this.modules = {};
            delete options.routes;

            _.extend(this, options);
        }
    });
}));
