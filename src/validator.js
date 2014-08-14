var ruleParamRegex = /^(.+?)\[(.+)\]$/;

var utils = (function() {
    var r20 = /%20/g,
        rbracket = /\[\]$/,
        rCRLF = /\r?\n/g,
        rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
        rsubmittable = /^(?:input|select|textarea|keygen)/i;

    return {
        getFields: function(form) {
            // TODO what the form
            var $form = $(form);
            return $form.map(function() {
                    var elements = $form.prop("elements");

                    return elements ? $.makeArray(elements) : this;
                })
                .filter(function() {
                    var type = this.type;

                    return this.name && !$(this).is(":disabled") &&
                        rsubmittable.test(this.nodeName) && !rsubmitterTypes.test(type)
                })
                .get();
        },
        isFunction: $.isFunction,
        isArray: $.isArray,
        isString: function(obj) {
            return typeof obj === 'string';
        },
        isBoolean: function(obj) {
            return typeof obj === 'boolean';
        },
        isObject: function(obj) {
            return obj && Object.prototype.toString.call(obj) === '[object Object]';
        }
    };
}());

var Debuger = {
    log: function(msg) {
        console.log(msg);
    }
};

function Validator(element, options) {
    var self = this;

    if (!self instanceof Validator) {
        return new Validator(element, options);
    }

    self._init(element, options);
}

Validator.prototype = {
    _init: function(element, options) {
        var self = this;

        self.$form = $("#form");

        self.rules = new Rules(options.rules); // 内置校验规则方法
        self.messages = new Message(); // 校验结果消息
        self.errors = []; // 校验结果错误消息集
        self.tips = {}; // focusin 提示消息
        self.deferred = {}; // 存放延迟的验证对象

        self.debug = true;

        // 自定义校验规则
        self.config = {};

        self._initEvent();
    },

    _initEvent: function() {
        var self = this;
    },

    setConfig: function(config) {
        this.config = config;
    },

    extendRules: function(rules) {

    }

    validate: function(fields) {
        var self = this;

        // 重置errors
        self.errors = [];

        if(!fields || $.isArray(fields)) {
            self._validateForm(fields);
        } else {
            self._validateField(fields);
        }

        $.when.apply(
            null,
            $.map(self.deferred, function(o) {
                return o;
            })
        )
        .done(function() {
            if (self.errors.length > 0) {
                self.debug && Debuger.log(self.errors);

                // trigger message
                self.$form.trigger("validator:form", [self.errors]);
            }
        });
    },

    _validateForm: function(fields) {
        if (!fields) {
            fields = utils.getFields(self.$form);
        }

        $.each(fields, function() {
            var element = this;

            self._validateField(element);
        });
    }

    _validateField: function(element) {
        var self = this,
            name,
            config,
            rules,
            checker,
            result,
            message,
            message = {};

        name = element.name;
        config = self.config[name];

        if (!element || !name || !config) return; // continue

        // rules array
        rules = config.split(';');

        // TODO 合并
        // 合并记录消息、合并想上广播的消息
        // 多条规则只发送一个结果
        for (var i = 0, rule; rule = rules[i]; i++) {
            var parts,
                param;

            parts = ruleParamRegex.exec(rule);
            if (parts) {
                rule = parts[1];
                param = parts[2];
            }

            checker = self.rules[rule];

            if (!checker) {
                throw {
                    name: "ValidatorHandlerError",
                    message: "handler " + checker
                }
            }

            // 验证失败或者验证结束返回
            result = checker.call(null, element, param);
            message = self.messages[rule];

            message = {
                name: name,
                element: element,
                message: message
            };

            // 异步校验
            if (utils.isObject(result) && utils.isFunction(result.then)) {
                self.deferred[name] = result;

                result.then(
                    function(data) {
                        // TODO validate data
                        var remoteDataChecker = function() {
                            return true;
                        }

                        message = formatMessage(message, remoteDataChecker(data));

                        self.errors.push(message);
                        self.$form.trigger("validator:field", [message]);
                    },

                    function(jqXHR, textStatus) {
                        message.result = false;

                        self.errors.push(message);
                        self.$form.trigger("validator:field", [message]);
                    }
                )
                    .always(function() {
                        delete self.deferred[name];
                    });

                // TODO break or continue
                break;
            }

            // 非异步校验
            message = formatMessage(message, result);

            // 记录验证消息，并广播当前字段的校验结果
            self.errors.push(message);
            self.$form.trigger("validator:field", [message]);

            // 当前规则校验失败停止后续规则校验
            if (result === false) {
                break;
            }
        };
    }
};


function Rules(rules) {
    var self = this;
    for (var r in rules) {
        if(rules.hasOwnProperty(r)) {
            self[r] = formatRule(rules[r]);
        }
    }
}

Rules.prototype = {
    required: function(element) {
        var val = $.trim($(element).val());

        return !!val;
    },

    remote: function(element, params) {
        var url = params,
            data,
            type = "GET";

        if (!params) return;

        return $.ajax({
            type: type,
            url: url,
            data: data
        });
    },

    number: function() {
        return !isNaN(value);
    }
};

function extendRules(rules) {
    for(var r in rules) {
        if(rules.hasOwnProperty(r)) {
            Rules.prototype[r] = formatRule(rules[r])
        }
    }
}

function Message() {
    this.required = "不能为空";
    this.remote = "验证失败";
}


function formatRule(rule) {
    var type = $.type(rule);

    if (type == "function") {
        return rule;
    } else if (type == "regexp") {
        return function(element) {
            return rule.test(element.value);
        };
    } else if (type == "array") {
        return function(element) {
            var result = rule[0].test(element.value);
            return {
                result: result,
                message: result ? '' : rule[1]
            }
        }
    }
}

function formatMessage(message, result) {
    if (!message) return;

    if (utils.isObject(result) && utils.isBoolean(result.result)) {
        message.result = result.result;
        message.message = result.message;
    } else {
        message.result = result;
    }

    return message;
}