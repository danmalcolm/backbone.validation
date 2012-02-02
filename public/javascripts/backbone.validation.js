Backbone.validation = {};

Backbone.validation = (function () {

	// Utility check functions
	var isNullOrUndefined = function (value) {
		return _.isNull(value) || _.isUndefined(value);
	};

	var asString = function (value) {
		if (isNullOrUndefined(value)) {
			throw new Error("Expected defined not null value");
		}
		return value.toString();
	};

	var areEqualIgnoreCase = function (value1, value2) {
		if (isNullOrUndefined(value1) || isNullOrUndefined(value2))
			return false;
		return value1 === value2 || asString(value1).toLowerCase() === asString(value2).toLowerCase();
	};

	var trimString = function (value) {
		return asString(value).replace(/^\s+|\s+$/g, "");
	};



	// ModelValidator - validates at model level
	var ModelValidator = function () {
		this.attrValidators = [];
	};

	_.extend(ModelValidator.prototype, {
		// Validate all model attrs
		validate: function (model) {
			var results = _.map(this.attrValidators, function (attrValidator) {
				return attrValidator.validate(model);
			});
			results = _.filter(results, function (r) { return r != null; });
			var isValid = results.length === 0;
			return { isValid: isValid, results: results };
		},
		// Just validate the supplied attributes
		validateAttrs: function (attrs) {
			var results = _.map(attrs, function (value, name) {
				var validator = _.find(this.attrValidators, function (v) { return v.name === name; });
				return validator ? validator.validateValue({ attr: name, path: name }, value) : null;
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

	// Validates a model attribute (also contains rule configuration functionality)
	var AttrValidator = function (name) {
		this.name = name;
		this.rules = [];
	};

	_.extend(AttrValidator.prototype, {
		validate: function (model) {
			var value = model.get(this.name);
			return this.validateValue({ attr: this.name, path: this.name }, value);
		},
		validateValue: function (context, value) {
			var rule;
			var errors = [];
			for (var i = 0, l = this.rules.length; i < l; i++) {
				rule = this.rules[i];
				if (!rule.isValid(value)) {
					var message = rule.options.message || messageBuilder.createMessage(rule.options, context);
					errors.push({ message: message, key: rule.key });
				}
			}
			return errors.length === 0 ? null : { attr: context.attr, path: context.path, errors: errors };
		},
		addRule: function (isValid, options, key) {
			var rule = new Rule(isValid, options, key);
			this.rules.push(rule);
			return this;
		},
		// value cannot be null or undefined
		notNull: function (options) {
			return this.addRule(function (value) {
				return !isNullOrUndefined(value);
			}, options, "not-null");
		},
		// value cannot be null or undefined
		range: function (options) {
			var values = options.values || { };
			return this.addRule(function (value) {
				if (options.ignoreCase) {
					return _.any(values, function (item) {
						return areEqualIgnoreCase(value, item);
					});
				} else {
					return _.include(values, value);
				}
			}, options, "range");
		},
		// non-empty string value
		notBlank: function (options) {
			return this.addRule(function (value) {
				return !isNullOrUndefined(value) && !_.isNull(value.toString().match(/\S/));
			}, options, "string-not-blank");
		},
		// string value of specified min and max length
		// min: minimum string length (inclusive) 
		// max: maximum string length (inclusive) 
		// trim: trim whitespace from start and end of value before testing length
		length: function (options) {
			return this.addRule(function (value) {
				if (isNullOrUndefined(value)) {
					return false;
				}
				value = options.trim === true ? trimString(value) : asString(value);
				return (!options.min || value.length >= options.min)
					&& (!options.max || value.length <= options.max);
			}, options, "string-length");
		},
		// custom check using a callback function. The function will be invoked with
		// 2 arguments (value, context) - the context contains the name of the attr
		// and the parent model if available
		check: function (func, options) {
			return this.addRule(function (value, context) {
				return func(value, context);
			}, options, "check");
		}
	});

	// Individual validation rule
	var Rule = function (isValid, options, key) {
		this.isValid = isValid;
		this.options = options || {};
		this.key = key || "";
	};


	// Message display
	var messageFormatUtility = {
		singularOrPlural: function (value, singular, plural) {
			return value == 1 ? singular : plural || singular + "s";
		},
		join: function (values, separator, lastSeparator) {
			return values.length === 0 ? values : values.slice(0, values.length - 1).join(separator) + lastSeparator + values[values.length];
		}
	};

	var MessageBuilder = function (config) {
		this.templates = config.templates || {};
		this.templates["default"] || (this.templates["default"] = "Please supply a valid value");
		this.templateCache = {};
	};

	_.extend(MessageBuilder.prototype, {
		createMessage: function (ruleOptions, context) {
			var key = ruleOptions.key || "";
			var item = this.templates[key] || this.templates["default"];
			var templateContent = _.isFunction(item) ? item(ruleOptions) : item;
			var template = this.templateCache["templateContent"] || (this.templateCache["templateContent"] = _.template(templateContent));
			var data = _.extend({ options: ruleOptions, context: context }, messageFormatUtility);
			return template(data);
		}
	});

	var defaultMessageConfig = {
		templates: {
			"not-null": "Please supply a value",
			"string-not-blank": "Please supply a value",
			"string-length": function (options) {
				var template = "Please supply a value";
				if (options.min && options.max) {
					template += " between <%= options.min %> and <%= options.max %> characters";
				} else if (options.min) {
					template += " of more than <%= options.min %> <%= singularOrPlural(options.min, 'character') %>";
				} else if (options.max) {
					template += " of less than <%= options.max %> <%= singularOrPlural(options.min, 'character') %>";
				}
				if (options.trim === true) {
					template += " excluding whitespace at the start or end";
				}
				return template;
			},
			"range": function (options) {
				var template = "Please supply a valid value (<%= join(options.values, ', ', ' or ') %>)";
				if (options.ignoreCase === true) {
					template += ", lower or upper case";
				}
				return template;
			},
			"default": "Please supply a valid value"
		}
	};

	var messageBuilder = new MessageBuilder(defaultMessageConfig);

	return {
		ModelValidator: ModelValidator,
		configureMessages: function (messageConfig) {
			messageBuilder = new MessageBuilder(messageConfig);
		}
	};

})();





