Backbone.validation = {};

Backbone.validation = (function () {

	// Helpers
	// -------

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

	var isNumeric = function (value) {

	};

	// Configuration
	// -------
	var config = { selfReferenceRuleKey: "self" };

	// Core validation functionality
	// -------

	// ModelValidator - validates at model level
	// Rules configured by config passed to constructor, which contains an
	// rules object, containing rules keyed by attr name in an object literal
	// and instanceRules, containing rules for the model itself
	//
	// {
	//	rules: {
	//	  attr1: rules.notNull(),
	//	  attr2: rules.length( { min:2, max: 10 })
	//	},
	//	instanceRules: rules.check(function() { ... })
	//}
	var ModelValidator = function (modelConfig) {
		this.validators = [];
		this.initialize(modelConfig);
	};

	_.extend(ModelValidator.prototype, {

		initialize: function (modelConfig) {
			var validator;
			modelConfig || (modelConfig = {});

			_.each(modelConfig.rules, function (ruleBuilder, key) {
				var getTarget;
				if (key === config.selfReferenceRuleKey) {
					// rules apply to the model instance
					getTarget = function (target) { return target; };
					key = "";
				} else {
					// rules apply to attribute
					getTarget = function (target) { return target.get(key); };
				}
				validator = new Validator(key, getTarget, ruleBuilder.rules);
				this.validators.push(validator);
			}, this);

			if (modelConfig.instanceRules instanceof RuleBuilder) {
				validator = new Validator("", function (target) { return target; }, modelConfig.instanceRules.rules);
				this.validators.push(validator);
			}
		},
		// Validate entire model
		validate: function (model) {
			var results = _.map(this.validators, function (validator) {
				return validator.validate(model);
			});
			results = _.filter(results, function (r) { return r != null; });
			return new Result(results);
		},
		// Validate the specified attrs
		validateAttrs: function (attrs) {
			var results = _.map(attrs, function (value, name) {
				var validator = _.find(this.validators, function (v) { return v.name === name; });
				return validator ? validator.validateValue({ attr: name, path: name }, value) : null;
			}, this);
			results = _.filter(results, function (r) { return r != null; });
			return new Result(results);
		}
	});

	var Result = function (errors) {
		this.invalidValues = errors;
		this.isValid = errors.length === 0;
	};
	_.extend(Result.prototype, {
		// Summary of result suitable for logging, alert during early development
		getSummary: function () {
			var message = "";
			for (var i = 0, l = this.invalidValues.length; i < l; i++) {
				var error = this.invalidValues[i];
				message += error.attr + ":\n";
				for (var j = 0, lj = error.errors.length; j < lj; j++) {
					message += "- " + error.errors[j].message + "\n";
				}
				message += "\n";
			}
			return message;
		}
	});
	// Validates an individual object (model, collection or attribute value) using the specified rules
	var Validator = function (name, getValue, rules) {
		this.name = name;
		this.getValue = getValue;
		this.rules = rules;
	};

	_.extend(Validator.prototype, {
		validate: function (target) {
			var value = this.getValue(target);
			return this.validateValue({ attr: this.name, path: this.name }, value);
		},
		validateValue: function (context, value) {
			var rule, isValid;
			var errors = [];
			for (var i = 0, l = this.rules.length; i < l; i++) {
				rule = this.rules[i];
				isValid = rule.isValid(value);
				if (!isValid) {
					var message = rule.options.message || messageBuilder.createMessage(rule, context);
					errors.push({ message: message, key: rule.key });
				}
			}
			return errors.length === 0 ? null : { attr: context.attr, path: context.path, errors: errors };
		}
	});

	// RuleBuilder - Used to configure rules
	// RuleBuilders are immutable, with each method that adds a rule returning a new instance with the additional rule.
	var RuleBuilder = function (rules) {
		this.rules = rules || [];
	};

	_.extend(RuleBuilder.prototype, {
		addRule: function (isValid, options, key) {
			var rule = new Rule(isValid, options, key);
			var newRules = this.rules.slice();
			newRules.push(rule);
			return new RuleBuilder(newRules);
		},
		// value cannot be null or undefined
		notNull: function (options) {
			return this.addRule(function (value) {
				return !isNullOrUndefined(value);
			}, options, "not-null");
		},
		// all characters in value must be numeric
		numeric: function (options) {
			return this.addRule(function (value) {
				if (isNullOrUndefined(value)) {
					return true;
				}
				return /^\d*$/.test(value);
			});
		},
		// value cannot be null or undefined
		range: function (options) {
			var values = options.values || {};
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
		// not null, not undefined, not-empty and not whitespace string value
		notBlank: function (options) {
			return this.addRule(function (value) {
				return !isNullOrUndefined(value) && !_.isNull(value.toString().match(/\S/));
			}, options, "string-not-blank");
		},
		// string value of specified min and max length
		// exact: exact string length
		// min: minimum string length (inclusive) 
		// max: maximum string length (inclusive) 
		// trim: trim whitespace from start and end of value before testing length
		length: function (options) {
			options || (options = {});
			return this.addRule(function (value) {
				if (isNullOrUndefined(value)) {
					return false;
				}
				value = options.trim === true ? trimString(value) : asString(value);
				if (!isNaN(options.exact)) {
					return value.length === options.exact;
				} else {
					return (!options.min || value.length >= options.min)
						&& (!options.max || value.length <= options.max);
				}
			}, options, "string-length");
		},
		// string value in valid email format
		email: function (options) {
			options || (options = {});
			return this.addRule(function (value) {
				if (!_.isString(value))
					return false;
				if (options.trim)
					value = trimString(value);
				return /^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+([A-Z]{2,4}|museum)$/i.test(value);
			}, options, "email");
		},
		_parseAnyCombineArgs: function (args) {
			var options;
			var ruleSets = [];
			for (var i = 0, l = args.length; i < l; i++) {
				var arg = args[i];
				if (arg instanceof RuleBuilder) {
					ruleSets.push(arg.rules);
				} else {
					if (i === l - 1 && _.isObject(arg)) {
						options = arg;
					}
				}
			}
			return { ruleSets: ruleSets, options: (options || {}) };
		},
		// Tests one or more sets of rules from a sequence of RuleBuilders. All
		// rules in one of the sets must pass for validation to be successful.
		any: function () {
			var args = this._parseAnyCombineArgs(arguments);
			var isValid = function (value, context) {
				return _.any(args.ruleSets, function (rules) {
					return _.all(rules, function (rule) {
						return rule.isValid(value, context);
					});
				});
			};
			return this.addRule(isValid, args.options);
		},
		// Tests one or more sets of rules from a sequence of RuleBuilders. All
		// rules in all of the sets must pass for validation to be successful.
		// Compresses multiple sets of rules into a single rule (usually to
		// show a single error message)
		combine: function () {
			var args = this._parseAnyCombineArgs(arguments);
			var isValid = function (value, context) {
				return _.all(args.ruleSets, function (rules) {
					return _.all(rules, function (rule) {
						return rule.isValid(value, context);
					});
				});
			};
			return this.addRule(isValid, args.options);
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


	/* --------------------------------------------*/
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
		createMessage: function (rule, context) {
			var key = rule.key || "";
			var item = this.templates[key] || this.templates["default"];
			var templateContent = _.isFunction(item) ? item(rule.options) : item;
			var template = this.templateCache[templateContent] || (this.templateCache[templateContent] = _.template(templateContent));
			// make data and methods on messageFormatUtility available to template code
			var data = _.extend({ options: rule.options, context: context }, messageFormatUtility);
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
			email: function (options) {
				return "Please supply a valid email address";
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

	/* --------------------------------------------*/
	// Model extension s

	var initValidator = function (target) {
		if (!target.validator) {
			var config = {
				rules: target.rules,
				instanceRules: target.instanceRules
			};
			target.validator = new ModelValidator(config);
		}
		return target.validator;
	};

	// The extension that is mixed in to Model to add validation functionality
	var modelValidation = {
		validate: function (attrs) {
			var validator = initValidator(this);
			var result = attrs ? validator.validateAttrs(attrs) : validator.validate(this);
			if (!result.isValid) {
				return result;
			}
		}
	};



	return {
		ModelValidator: ModelValidator,
		configureMessages: function (messageConfig) {
			messageBuilder = new MessageBuilder(messageConfig);
		},
		rules: new RuleBuilder(),
		modelValidation: modelValidation
	};

})();





