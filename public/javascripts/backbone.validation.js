Backbone.validation = {};

Backbone.validation = (function () {

	var ModelValidator = function () {
		this.attrValidators = [];
	};
	_.extend(ModelValidator.prototype, {
		validate: function (model) {
			var results = _.map(this.attrValidators, function (attrValidator) {
				return attrValidator.validate(model);
			});
			results = _.filter(results, function (r) { return r != null; });
			var isValid = results.length === 0;
			return { isValid: isValid, results: results };
		},
		validateAttrs: function (attrs) {
			var results = _.map(attrs, function (value, name) {
				var validator = _.find(this.attrValidators, function (v) { return v.name === name; });
				return validator ? validator.validateValue(value) : null;
			}, this);
			results = _.filter(results, function (r) { return r != null; });
			var isValid = results.length === 0;
			return { isValid: isValid, results: results };
		},

		attr: function (name) {
			var attrValidator = _.find(this.attrValidators, function (v) { return v.name === name; });
			if (!attrValidator) {
				attrValidator = new AttrValidator(name);
				this.attrValidators.push(attrValidator);
			}
			return attrValidator;
		}
	});

	var Rule = function (isValid, options) {
		this.isValid = isValid;
		this.message = options.message;
	};

	var AttrValidator = function (name) {
		this.name = name;
		this.rules = [];
	};

	var isNullOrUndefined = function (value) {
		return _.isNull(value) || _.isUndefined(value);
	};

	var asString = function (value) {
		if (isNullOrUndefined(value)) {
			throw new Error("Expected defined not null value");
		}
		return value.toString();
	};

	var trimString = function (value) {
		return asString(value).replace(/^\s+|\s+$/g, "");
	};

	_.extend(AttrValidator.prototype, {
		validate: function (model) {
			var value = model.get(this.name);
			var errors = this.validateValue(value);
			return errors;
		},
		validateValue: function (value) {
			var ruleResults = _.map(this.rules, function (r) {
				var isValid = r.isValid(value, { attrName: this.name });
				return { isValid: isValid, message: r.message };
			});
			ruleResults = _.filter(ruleResults, function (r) { return r.isValid === false; });
			return ruleResults.length > 0 ? { path: this.attr, errors: ruleResults} : null;
		},
		addRule: function (isValid, options) {
			var rule = new Rule(isValid, options);
			this.rules.push(rule);
			return this;
		},
		// value cannot be null or undefined
		notNull: function (message) {
			return this.addRule(function (value) {
				return !isNullOrUndefined(value);
			}, { message: message, key: "notNull" });
		},
		// non-empty string value
		notBlank: function (message) {
			return this.addRule(function (value) {
				return !isNullOrUndefined(value) && !_.isNull(value.toString().match(/\S/));
			}, { message: message, key: "notNull" });
		},
		// string value of specified min and max length
		// min: minimum string length (inclusive) 
		// max: maximum string length (inclusive) 
		// trim: trim whitespace from start and end of value before testing length
		length: function (options, message) {
			return this.addRule(function (value) {
				if (isNullOrUndefined(value)) {
					return false;
				}
				value = options.trim ? trimString(value) : asString(value);
				return (!options.min || value.length >= options.min)
					&& (!options.max || value.length <= options.max);
			}, { message: message, key: "notNull" });
		},
		// custom check using a callback function. The function will be invoked with
		// 2 arguments (value, context) - the context contains the name of the attr
		// and the parent model if available
		check: function (func, message) {
			return this.addRule(function (value, context) {
				return func(value, context);
			}, { message: message, key: "check" });
		}
	});

	return {
		ModelValidator: ModelValidator
	};

})();





