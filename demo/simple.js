var Model = Backbone.Model.extend(Backbone.validation.modelValidation);

var rules = Backbone.validation.rules;

var User = Model.extend({
	attributeRules: {
		email: rules.email({ trim: true }),
		password: rules.length({ trim: true, min: 6, max: 20 })
	},
	sync: function (method, model, options) {
		var resp = { id: 1234 };
		_.extend(resp, this.attributes);
		options.success(resp);
	}
});

var ErrorsView = Backbone.View.extend({
	initialize: function () {
		this.invalidValues = [];
		this.$el.hide();
	},
	template: _.template($('#validation-messages').html()),
	update: function (invalidValues) {
		this.invalidValues = invalidValues || [];
		this.render();
	},
	render: function () {
		if (this.invalidValues.length > 0) {
			var $messages = this.$(".messages");
			$messages.html(this.template({ invalidValues: this.invalidValues }));
			this.$el.show(300);
		} else {
			this.$el.hide();
		}
		return this;
	}
});

// Some

var SimpleValidationView = Backbone.View.extend({

	initialize: function () {
		this.errorsView = new ErrorsView({ el: this.$(".errors") });
	},
	events: {
		"change [name=email]": "updateEmail",
		"change [name=password]": "updatePassword",
		"click input:submit": "save"
	},
	save: function (e) {
		e.preventDefault();
		var result = this.model.validate();
		if (!result || result.isValid) {
			this.model.save(null, { success: function () {
				alert("Well done, you have registered!");
			}
			});
		}
		else {
			this.errorsView.update(result.invalidValues);
		}
	},
	updateEmail: function (ev) {
		this.updateModel({ email: $(ev.target).val() });
	},
	updatePassword: function (ev) {
		this.updateModel({ password: $(ev.target).val() });
	},
	updateModel: function (attrs) {
		this.model.set(attrs, { silent: true });
	}
});

var InteractiveValidationView = Backbone.View.extend({
	initialize: function () {
		this.errorsView = new ErrorsView({ el: this.$(".errors") });
		// Records attributes that user has updated - this is used
		// to control whether we show validation errors for values
		// that haven't been entered yet
		this.attemptedAttributes = {};
		this.attemptedSave = false;
		this.model.on("error", this.error, this);
	},
	events: {
		"change input[name='email']": "updateEmail",
		"keyup input[name=password]": "updatePassword",
		"click input:submit": "save"
	},
	save: function (e) {
		e.preventDefault();
		this.attemptedSave = true;
		if (this.validateModel()) {
			this.model.save({
				success: function () {
					alert("Well done, you have registered!");
				}
			});
		}
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
		this.model.set(attrs, { silent: true });
		this.validateModel();
	},
	validateModel: function () {
		var result = this.model.validate();
		var invalidValues;
		if (result) {
			invalidValues = _.filter(result.invalidValues, function (value) {
				return this.attemptedSave || this.attemptedAttributes[value.attr] === true;
			}, this);
			this.enableSave(false);
		} else {
			invalidValues = [];
			this.enableSave(true);
		}
		this.errorsView.update(invalidValues);
	},
	enableSave: function (enabled) {
		if (enabled) {
			this.$("input:submit").removeAttr("disabled").attr("title", "Register using the values supplied");
		}
		else {
			this.$("input:submit").attr("disabled", "disabled").attr("title", "Please enter all the required information before submitting the form");
		}
	},
	render: function () {
		this.enableSave(this.model.isValid());
		return this;
	}
});


$(function () {

	new SimpleValidationView({
		el: "#simple",
		model: new User({ email: "", password: "" })
	}).render();

	new InteractiveValidationView({
		el: "#interactive",
		model: new User({ email: "", password: "" })
	}).render();

});