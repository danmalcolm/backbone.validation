$(function () {

	// alias Backbone.validation.rules to make rules definition on our models more concise
	var rules = Backbone.validation.rules;

	var Model = Backbone.Model.extend(Backbone.validation.modelValidation);

	var User = Model.extend({
		// Define validation rules
		rules: {
			email: rules.email({ trim: true }),
			password: rules.length({ trim: true, min: 6, max: 20 })
		},
		// Pretend to save to server
		sync: function (method, model, options) {
			var resp = { id: 1234 };
			_.extend(resp, this.attributes);
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
				password: this.$("input[name=password]").val()
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

	// Displays validation errors interactively as user updates fields in the
	// form. This is more challenging:
	// 1. By default, Backbone.Model does not allow attributes to get into 
	// an invalid state. If we're updating individual attributes interactively
	// as they're updated, wediff between form and model.
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
			// provide feedback as password is typed - could be issues with
			// autocomplete, maybe need change aswell
			"keyup input[name=password]": "updatePassword",
			"click input:submit": "save"
		},
		updateEmail: function (ev) {
			this.updateModel({ email: $(ev.target).val() });
		},
		updatePassword: function (ev) {
			this.updateModel({ password: $(ev.target).val() });
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
				this.enableSave(true);
				return true;
			} else {
				var invalidValues = result.invalidValues;
				if (!this.attemptedSave) {
					invalidValues = _.filter(result.invalidValues, function (value) {
						return this.attemptedAttributes[value.attr] === true;
					}, this);
				}
				this.errorsView.update(invalidValues);
				this.enableSave(false);
				return false;
			}
		},
		enableSave: function (enabled) {
			if (enabled) {
				this.$("input:submit").removeAttr("disabled").attr("title", "Register using the values supplied");
			}
			else {
				this.$("input:submit").attr("disabled", "disabled").attr("title", "Please enter all the required information before submitting the form");
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
		},
		render: function () {
			this.enableSave(this.model.isValid());
			return this;
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

});