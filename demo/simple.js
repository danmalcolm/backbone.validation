$(function () {

	// alias Backbone.validation.rules to make rules definition on our models more concise
	var rules = Backbone.validation.rules;

	var Model = Backbone.Model.extend(Backbone.validation.modelValidation);

	var User = Model.extend({

		defaults: {
			agreeTerms: false
		},

		// Define validation rules
		rules: {
			email: rules.email({ trim: true }),
			password: rules.length({ trim: true, min: 6, max: 20, message: "Please enter a value between 6 and 20 characters" }),
			agreeTerms: rules.truthy({ message: "Please agree to everything" })
		},
		// Pretend to save to server resulting in generated id
		sync: function (method, model, options) {
			var resp = _.extend({ id: 1234 }, this.attributes);
			options.success(resp);
		}
	});

	// Displays summary of validation errors
	var ErrorsView = Backbone.View.extend({
		initialize: function () {
			this.$el.hide();
		},
		template: _.template($('#validation-messages').html()),
		clear: function () {
			this.update();
		},
		update: function (invalidValues) {
			if (invalidValues && invalidValues.length > 0) {
				var $messages = this.$(".messages");
				$messages.html(this.template({ invalidValues: invalidValues }));
				this.$el.show();
			} else {
				this.$el.hide();
			}
			return this;
		}
	});

	// Simple form example. We attempt to update all attributes when the user
	// submits the form and display summary of validation messages at top of
	// form if validation fails.
	var SimpleValidationView = Backbone.View.extend({

		initialize: function () {
			this.errorsView = new ErrorsView({ el: this.$(".errors") });
			// Attempting to set invalid attributes results in error
			// being triggered
			this.model.on("error", this.error, this);
		},
		events: {
			"click input:submit": "save"
		},
		save: function (e) {
			e.preventDefault();

			var attrs = {
				email: this.$("input[name=email]").val(),
				password: this.$("input[name=password]").val(),
				agreeTerms: this.$("input[name=agreeTerms").is(":checked")
			};
			var self = this;
			this.model.save(attrs, {
				success: function (model) {
					self.errorsView.clear();
					alert("Well done, you have registered!" + JSON.stringify(model.attributes));
				}
			});
		},
		// Fired when invalid attributes are set
		error: function (model, result) {
			if (result && result.invalidValues) {
				this.errorsView.update(result.invalidValues);
			}
		}
	});

	// Displays validation errors interactively as user updates form fields. This 
	// is more challenging. Backbone.Model does not allow attributes to get into 
	// an invalid state. If we call set with invalid attributes, the model will
	// not be updated and there will be a difference between what is in the form
	// and the model's attributes. The solution taken here is to update attributes
	// silently to bypass validation, then validate the entire model and display 
	// feedback to the user. We do not display errors (e.g. required values) for
	// attributes that the user hasn't yet attempted to set - that would be like
	// somebody saying "You are gonna pay for that aren't you, punk?" after you've 
	// put a loaf of bread in your shopping trolley.

	// Note - this form tracking functionality will probably end up being extracted
	// into a helper class within the core library. Just trying to work out what we
	// need.
	var InteractiveValidationView = Backbone.View.extend({
		initialize: function () {
			this.errorsView = new ErrorsView({ el: this.$(".errors") });
			// Records attributes that user has updated - this is used
			// to prevent form from showing validation errors for values
			// that haven't been entered yet
			this.attemptedAttributes = {};
			// Once user has attempted to save, we show validation errors
			// for all attributes
			this.attemptedSave = false;
		},
		events: {
			"change input[name=email]": "updateEmail",
			// provide feedback as password is typed
			"keyup input[name=password]": "updatePassword",
			"change input[name=password]": "updatePassword",
			"change input[name=agreeTerms]": "updateAgreeTerms",
			"click input:submit": "save"
		},
		updateEmail: function (ev) {
			this.updateModel({ email: $(ev.target).val() });
		},
		updatePassword: function (ev) {
			this.updateModel({ password: $(ev.target).val() });
		},
		updateAgreeTerms: function (ev) {
			this.updateModel({ agreeTerms: $(ev.target).is(":checked") });
		},
		updateModel: function (attrs) {
			for (var key in attrs) {
				this.attemptedAttributes[key] = true;
			}
			// Update attributes silently so model is in sync with form
			this.model.set(attrs, { silent: true });
			// Validate the entire model
			this.validateModel();
		},
		validateModel: function () {
			var result = this.model.validate();
			if (!result) {
				// Model.validate returns nothing if there are no errors
				this.errorsView.clear();
				return true;
			} else {
				var invalidValues = result.invalidValues;
				if (!this.attemptedSave) {
					invalidValues = _.filter(result.invalidValues, function (value) {
						return this.attemptedAttributes[value.attr] === true;
					}, this);
				}
				this.errorsView.update(invalidValues);
				return false;
			}
		},
		save: function (e) {
			e.preventDefault();
			// It now makes sense to display errors for all attributes
			this.attemptedSave = true;
			if (this.validateModel()) {
				var self = this;
				this.model.save(null, {
					success: function (model) {
						self.errorsView.clear();
						alert("Well done, you have registered!" + JSON.stringify(model.attributes));
					}
				});
			}
		}
	});

	// Displays validation errors interactively as user updates form fields, this time
	// using a convention to display the validation errors inline next to the relevant
	// fields in the form.

	// Note - inline message display will also probably end up being extracted
	// into a helper class within the core library

	// Examples of different ways of displaying validation messages
	var messageDisplayHandlers = {
		// With a bepoke form layout, we may want to control the exact position
		// of validation messages by putting placeholder elements in the form
		placeholder: {
			reset: function ($el) {
				$el.find("[data-validationmessagetype=placeholder]").hide();
			},
			display: function ($el, path, info) {
				var $placeholder = $el.find('[data-validationmessagetype=placeholder][data-validationmessagepath=' + path + ']');
				$placeholder.append(info);
				return $placeholder.length > 0;
			}
		},
		// With a bepoke form layout, we may also want to show / hide a customised element if an attribute
		// is valid
		custom: {
			reset: function ($el) {
				$el.find("[data-validationmessagetype=custom]").hide();
			},
			display: function ($el, path, info) {
				var $element = $el.find('[data-validationmessagetype=custom][data-validationmessagepath=' + path + ']');
				$element.show();
				return $element.length > 0;
			}
		},
		// With a more standardised form layout, we can insert validation messages in
		// a consistent position relative to the form element
		standard: {
			reset: function ($el) {
				$el.find(".validation-message").remove();
			},
			display: function ($el, path, info) {
				var $container = $el.find(':input[name=' + path + ']').parents("div.field:first");
				$container.prepend(info);
				return $container.length > 0;
			}
		}
	};

	var ValidationDisplayHelper = function ($form) {
		this.$form = $form;
		this.reset();
	};

	_.extend(ValidationDisplayHelper.prototype, {
		handlers: [messageDisplayHandlers.placeholder, messageDisplayHandlers.custom, messageDisplayHandlers.standard],
		template: _.template($('#inline-invalid-value-info').html()),
		update: function (invalidValues) {
			// Remove any previous messages
			_.each(this.handlers, function (h) { h.reset(this.$form); }, this);

			if (invalidValues) {
				for (var i = 0, l = invalidValues.length; i < l; i++) {
					var invalidValue = invalidValues[i];
					var info = this.template({ invalidValue: invalidValue });
					// Handlers in order of priority - display errors using first successful handler
					_.any(this.handlers, function (h) { return h.display(this.$form, invalidValue.path, info); }, this);
				}
			}
		},
		reset: function () {
			this.update();
		}
	});

	var InlineValidationView = Backbone.View.extend({
		initialize: function () {
			this.helper = new ValidationDisplayHelper(this.$("form"));
			// Records attributes that user has updated - this is used
			// to prevent form from showing validation errors for values
			// that haven't been entered yet
			this.attemptedAttributes = {};
			// Once user has attempted to save, we show validation errors
			// for all attributes
			this.attemptedSave = false;
		},
		events: {
			"change input[name=email]": "updateEmail",
			// provide feedback as password is typed
			"keyup input[name=password]": "updatePassword",
			"change input[name=password]": "updatePassword",
			"change input[name=agreeTerms]": "updateAgreeTerms",
			"click input:submit": "save"
		},
		updateEmail: function (ev) {
			this.updateModel({ email: $(ev.target).val() });
		},
		updatePassword: function (ev) {
			this.updateModel({ password: $(ev.target).val() });
		},
		updateAgreeTerms: function (ev) {
			this.updateModel({ agreeTerms: $(ev.target).is(":checked") });
		},
		updateModel: function (attrs) {
			for (var key in attrs) {
				this.attemptedAttributes[key] = true;
			}
			// Update attributes silently so model is in sync with form
			this.model.set(attrs, { silent: true });
			// Validate the entire model
			this.validateModel();
		},
		validateModel: function () {
			var result = this.model.validate();
			if (!result) {
				// Model.validate returns nothing if there are no errors
				this.helper.update();
				return true;
			} else {
				var invalidValues = result.invalidValues;
				if (!this.attemptedSave) {
					invalidValues = _.filter(result.invalidValues, function (value) {
						return this.attemptedAttributes[value.attr] === true;
					}, this);
				}
				this.helper.update(invalidValues);
				return false;
			}
		},
		save: function (e) {
			e.preventDefault();
			// It now makes sense to display errors for all attributes
			this.attemptedSave = true;
			if (this.validateModel()) {
				var self = this;
				this.model.save(null, {
					success: function (model) {
						self.helper.reset();
						alert("Well done, you have registered!" + JSON.stringify(model.attributes));
					}
				});
			}
		}
	});


	// Start things up
	new SimpleValidationView({
		el: "#simple",
		model: new User({ email: "", password: "" })
	}).render();

	new InteractiveValidationView({
		el: "#interactive",
		model: new User({ email: "", password: "" })
	}).render();

	new InlineValidationView({
		el: "#inline",
		model: new User({ email: "", password: "" })
	}).render();

});