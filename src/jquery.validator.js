! function() {
	var PLUGIN_NAME = "validator";

	$.fn[PLUGIN_NAME] = function(options) {

		var self = this;

		self.each(function() {
			var instance = $(this).data[PLUGIN_NAME],
				passbook = false,
				autoSubmit = true;		// 验证通过后是否自动提交

			if (!instance) {
				var validator = new Validator(this, options);

				instance = validator;
				$(this).data(PLUGIN_NAME, instance);

				validator.setConfig(options.filds);
        
				$(this).on("submit", function(e) {

					if(passbook) return true;

					var fields = utils.getFields($(this));

			        e.preventDefault();
			        
			        // validate
			        validator.validate(fields);
			        
				})
				.on("focusin.validator", "input", function() {
					
				})
				.on("focusout.validator", "input", function() {
					validator.validate(this);
				})
				.on("message.validator", $.proxy(showMsg, null))
				.on("valid.validator", function() {
					if(autoSubmit) {
						passbook = true;
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
}()