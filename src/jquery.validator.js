! function() {
	var PLUGIN_NAME = "validator";

	$.fn[PLUGIN_NAME] = function(options) {

		var self = this;

		self.each(function() {
			var instance = $(this).data[PLUGIN_NAME];

			if (!instance) {
				var validator = new Validator(this, options);
				instance = validator;
				$(this).data[PLUGIN_NAME] = instance;

				validator.setConfig(options.filds);
        
				$(this).on("submit", function(e) {
					var fields = utils.getFields($(this));

			        e.preventDefault();
			        
			        // validate
			        validator.validate(fields);
				})
				.on("focusin", "input", function() {
					
				})
				.on("focusout", "input", function() {
					validator.validate(this);
				})
				.on("validator:form", $.proxy(showMsg, null));
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