var ruleParamRegex = /^(.+?)\[(.+)\]$/;

var utils = (function() {
    var r20 = /%20/g,
        rbracket = /\[\]$/,
        rCRLF = /\r?\n/g,
        rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
        rsubmittable = /^(?:input|select|textarea|keygen)/i;

    return {
        getFields: function(form) {
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
        isNumber: function(obj) {
            return typeof obj === 'number';
        },
        isObject: function(obj) {
            return obj && Object.prototype.toString.call(obj) === '[object Object]';
        }
    };
}());

var Debuger = {
    log: function(msg) {
        "console" in window && console.log(msg);
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

        self.$form = $(element);

        self.rules = new Rules(options.rules);  // 内置校验规则方法
        self.messages = new Message();          // 校验结果消息
        self.errors = [];                       // 校验结果错误消息集
        self.tips = {};                         // focusin 提示消息
        self.deferred = {};                     // 存放延迟的验证对象

        self.passport = true;                  // 所有config中表单是否验证通过
        self.debug = true;
        self.lazy = false;                      // 是否懒惰验证

        self.valid = options.valid;
        self.invalid = options.invalid;

        // 自定义校验规则
        self.config = {};

        self._initEvent();
    },

    _initEvent: function() {
        var self = this;

        self.$form.on("validator:valide",
            $.proxy(self.validate, self) 
        );
        /*
        .on("validator:valide:field",
            $.proxy(self._validateField, self)
        )
        .on("validator:valide:form",
            $.proxy(self._validateForm, self)
        );*/
    },

    setFields: function(config) {
        if(!config) return;

        this.config = $.extend({}, this.config, config);
    },

    validate: function(fields) {
        var self = this;

        // do reset before validate
        self._reset();

        if(arguments.length > 1) {
            fields = arguments[1];
        }

        if(!fields || $.isArray(fields)) {
            self._validateForm(fields);
        } else if(fields.nodeName) {
            self._validateField(fields);
        } else {
            self._validateForm();
        }

        $.when.apply(
            null,
            $.map(self.deferred, function(o) {
                return o;
            })
        )
        .done(function() {
            // TODO
            // 不要根据errors的length判断valid and invalid
            
                self.debug && Debuger.log("validate complete");

                // trigger message
                self.$form.trigger("message.validator", [self.errors]);

                if(self.errors.length) {
                    self.debug && Debuger.log("validate invalid");

                    // invalid callback
                    if(utils.isFunction(self.invalid)) {
                        self.invalid.call(null);
                    }

                    self.$form.trigger("invalid.validator");
                } else {
                    self.debug && Debuger.log("validate valid");

                    // valid callback
                    if(utils.isFunction(self.valid)) {
                        self.valid.call(null);
                    }

                    self.$form.trigger("valid.validator");
                }
            
        });

        return self.passport;
    },

    _reset: function() {
        // 重置errors
        this.errors = [];
        this.passport = true;
    },

    _validateForm: function(fields) {
        var self = this;

        self.debug && Debuger.log("validate form");

        if (!fields) {
            fields = utils.getFields(self.$form);
        }

        $.each(fields, function() {
            var element = this;

            // 懒惰校验在第一次校验失败后即返回
            if(self.lazy && self.passport === false) {
                return false;
            }

            self._validateField(element);
        });
    },

    _validateField: function(element) {
        var self = this,
            name,
            required,   // 是否必填项
            config,
            rules,
            checker,
            result,     // boolean, {result, message}, jqXHR
            messages = {};

        name = element.name;
        config = self.config[name];

        // no validte
        if (!element || !name || !config) return;

        required = /required|checked/.test(config);

        // TODO
        // 把这段代码提出去
        // 增加复用性
        // type 不严格
        if(!required) {
            if(element.type == "text" && $.trim(element.value)  == "") {
                self.errors.push({
                    name: name,
                    element: element,
                    message: self.messages[rule],
                    result: true
                });

                return;
            }
        }

        // rules array
        rules = config.split(';');

        for (var i = 0, len = rules.length; i < len; i++) {
            var rule = rules[i],
                parts,
                param;

            parts = ruleParamRegex.exec(rule);
            if (parts) {
                rule = parts[1];
                param = parts[2];
            }

            // 校验函数
            checker = self.rules[rule];

            if (!checker) {
                throw {
                    name: "ValidatorHandlerError",
                    message: "handler " + checker
                }
            }

            // 验证失败或者验证结束返回
            result = checker.call(self, element, param);

            messages = {
                name: name,
                element: element,
                message: self.messages[rule]
            };

            // 验证失败，销毁passport
            if(self.passport !== false && result == false) {
                self.passport = false;
            }
            
            // 异步校验
            if (utils.isObject(result) && utils.isFunction(result.then)) {
                self.deferred[name] = result;
                if(self.passport !== false) {
                    self.passport = undefined;
                }

                result.then(
                    function(data) {
                        // TODO validate data
                        var remoteDataChecker = function() {
                            return true;
                        }

                        messages = formatMessage(messages, remoteDataChecker(data));

                        self.errors.push(messages);
                        if(self.passport !== false) {
                            self.passport = true;
                        }
                        self.$form.trigger("validator:field", [messages]);
                    },

                    function(jqXHR, textStatus) {
                        messages.result = false;

                        self.errors.push(messages);
                        if(self.passport !== false) {
                            self.passport = false;
                        }
                        self.$form.trigger("validator:field", [messages]);
                    }
                )
                .always(function() {
                    delete self.deferred[name];
                });

                // TODO
                // break or continue
                break;
            }

            // 非异步校验
            messages = formatMessage(messages, result);
            
            // 当前规则校验失败停止后续规则校验
            if (result === false || i === len - 1) {

                // 记录验证消息，并广播当前字段的校验结果
                self.errors.push(messages);
                self.$form.trigger("validator:field", [messages]);
                
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

    checked: function(element, params) {
        var self = this,
            count,
            flg;

        count = self.$form.find('input[name="' + element.name + '"]').filter(function() {
            return !this.disabled && this.checked && $(this).is(':visible');
        }).length;

        if(params) {
            flg = inRange(count, params);
            if(flg == true) {
                return true;
            } else {
                return flg;
            }
        } else {
            return !!count;
        }
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

Rules.extend = function(rules) {
    for(var r in rules) {
        if(rules.hasOwnProperty(r)) {
            Rules.prototype[r] = formatRule(rules[r]);
        }
    }
};



/**
 * ___{0}___{1}___
 *  0  1  2  3
 */
function inRange(value, params) {
    if(!params) return;

    var p, len;

    p = params.split('~');
    len = p.length;

    if(len == 2) {
        return (value >= p[0] && value <= p[1]) ? true : [3, p[0], p[1]];
    }

    if(/^\~/.test(params)) {
        return value <= p[0] ? true : [1, p[0]];
    } else if(/\~$/.test(params)) {
        return value >= p[0] ? true : [4, p[0]];
    } else {
        return value == p[0] ? true : [2, p[0]];
    }

}

/**
 * Message 构造函数
 */
function Message() {
    
}

Message.prototype =  {
    constructor: Message,
    required : "不能为空",
    remote : "验证失败",
    checked : ["不能为空", "请最多选择{0}项", "请选择{0}项", "请选择{0}到{1}项", "请至少选择{0}项"]
};


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
    } else if(utils.isArray(result) && utils.isArray(message.message)) {
        message.message = message.message[result[0]];
        message.message = message.message.replace(/{(\d+)}/g, function(p0, p1) {
            return result[Number(p1) + 1];
        });
        message.result = false;
    } else {
        message.result = result;
    }

    return message;
}