Backbone.validation = {};

Backbone.validation = (function () {

	/* --------------------------------------------*/
	// Utilities

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

	/* --------------------------------------------*/
	// Core validation functionality

	// ModelValidator - validates at model level
	// Rules configured by config passed to constructor, which contains an
	// attributeRules object, containing rules keyed by attr name in an object literal
	// and instanceRules, containing rules for the model itself
	//
	// {
	//	attributeRules: {
	//	  attr1: rules.notNull(),
	//	  attr2: rules.length( { min:2, max: 10 })
	//	},
	//	instanceRules: rules.check(function() { ... })
	//}
	var ModelValidator = function (config) {
		this.validators = [];
		this.initialize(config);
	};

	_.extend(ModelValidator.prototype, {
		
		initialize: function (config){
			var validator;
			config || (config = {});

			_.each(config.attributeRules, function (ruleBuilder, name) {
				validator = new Validator(name, function (target) { return target.get(name); }, ruleBuilder.rules);
				this.validators.push(validator);
			}, this);

			if(config.instanceRules instanceof RuleBuilder) {
				validator = new Validator("", function(target) { return target; }, config.instanceRules.rules);
				this.validators.push(validator);
			}
		},
		// Validate entire model
		validate: function (model) {
			var results = _.map(this.validators, function (validator) {
				return validator.validate(model);
			});
			results = _.filter(results, function (r) { return r != null; });
			var isValid = results.length === 0;
			return { isValid: isValid, results: results };
		},
		// Validate the specified attrs
		validateAttrs: function (attrs) {
			var results = _.map(attrs, function (value, name) {
				var validator = _.find(this.validators, function (v) { return v.name === name; });
				return validator ? validator.validateValue({ attr: name, path: name }, value) : null;
			}, this);
			results = _.filter(results, function (r) { return r != null; });
			var isValid = results.length === 0;
			return { isValid: isValid, results: results };
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
			var rule;
			var errors = [];
			for (var i = 0, l = this.rules.length; i < l; i++) {
				rule = this.rules[i];
				if (!rule.isValid(value)) {
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
			var template = this.templateCache["templateContent"] || (this.templateCache["templateContent"] = _.template(templateContent));
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
				attributeRules: target.attributeRules,
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





