! function() {
	var PLUGIN_NAME = "validator";

	$.fn[PLUGIN_NAME] = function(options) {

		var self = this;

		self.each(function() {
			var instance = $(this).data[PLUGIN_NAME],
				passport = false,		// passport为true时表示验证通过自动提交表单
				autoSubmit = false,		// 验证通过后是否自动提交
				timely = false;			// 即时验证

			if (!instance) {
				var validator = new Validator(this, options);

				// cache instance
				instance = validator;
				$(this).data(PLUGIN_NAME, instance);

				// config validator
				validator.setFields(options.filds);
		
				// event
				$(this).on("submit", function(e) {

					// 取得passport的表单本次不验证
					if(passport) return true;
					e.preventDefault();
					var fields = utils.getFields($(this));
					
					// validate
					validator.validate(fields);
					
				})

				// TODO
				// radio/checkbox validate time
				.on("focusin.validator", "input", function() {
					if(!timely) return;
				})
				.on("focusout.validator", "input", function() {
					if(!timely) return;
					validator.validate(this);
				})
				.on("message.validator", $.proxy(showMsg, null))
				.on("valid.validator", function() {
					// 原始提交的表单
					if(autoSubmit) {
						passport = true;
						this.submit();
					}
				})
				.on("invalid.validator", function() {
				});
			}
		});

		return self;
	};

	function showMsg (e, messages) {
		var $form = $("#form");
		var self = this,
			$box;

		if (!messages || messages.length == 0) return;

		$.each(messages, function(i, message) {
			$box = $form.find("div[for=" + message.name + "]");
			if (!$box.length) {
				$box = $('<div></div>').attr("for", message.name);

				// checkbox & radio
				$box.appendTo($(message.element.parentNode));

				// textbox
			}

			if(message.result) {
				$box.html("");
			} else {
				$box.html(message.message);
			}
		});
	};

	Rules.extend({
		email: [/^[\w\+\-]+(\.[\w\+\-]+)*@[a-z\d\-]+(\.[a-z\d\-]+)*\.([a-z]{2,4})$/i, '邮箱格式不正确'],
		mobile: [/^1[3-9]\d{9}$/, "手机号格式不正确"],  //移动电话
	});
}()