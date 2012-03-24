Backbone.validation = (function () {

	var emptyArray = [];

	// Utility functions
	// -------

	var isNullOrUndefined = function (value) {
		return _.isNull(value) || _.isUndefined(value);
	};

	var asString = function (value) {
		if (isNullOrUndefined(value)) {
			throw new Error("Expected a defined non null value");
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

	// Helpers
	// -------

	// Generates path to invalid values
	var pathFormatters = {
		"default": {
			appendAttribute: function (path, key) {
				var atStart = (path.length === 0);
				return path + (!atStart ? "." : "") + key;
			},
			appendCollectionItem: function (path, index) {
				return path + "[" + index + "]";
			}
		},
		"ruby-on-rails": {
			appendAttribute: function (path, key) {
				var atStart = (path.length === 0);
				return path + (!atStart ? "[" : "") + key + (!atStart ? "]" : "");
			},
			appendCollectionItem: function (path, index) {
				return path + "[" + index + "]";
			}
		}
	};

	// Configuration
	// -------

	var defaultConfig = {
		selfReferenceRuleKey: "self",
		multiAttributeKeySeparator: ",", 
		pathFormatter: pathFormatters["default"]
	};

	var config = defaultConfig;

	// Core validation functionality
	// -------

	// Validates a Backbone.Model instance
	var ModelValidator = function (modelConfig) {
		this.validators = [];
		this.initialize(modelConfig);
	};
	_.extend(ModelValidator.prototype, {
		initialize: function (modelConfig) {
			var validator;
			_.each(modelConfig.rules, function (ruleBuilder, key) {
				validator = new Validator(key, ruleBuilder.rules);
				this.validators.push(validator);
			}, this);
		},
		validate: function (attributes, options, context) {
			var builder = new ResultBuilder();
			var values;
			for (var i = 0, l = this.validators.length; i < l; i++) {
				values = this.validators[i].validate(attributes, options, context);
				builder.add(values);
			}
			return builder.getResult();
		}
	});

	// Validates a Backbone.Collection instance
	var CollectionValidator = function (collectionConfig) {
		this.validators = [];
		this.initialize(collectionConfig);
	};
	_.extend(CollectionValidator.prototype, {
		initialize: function (collectionConfig) {
			var validator;
			_.each(collectionConfig.rules, function (ruleBuilder, key) {
				if (key !== config.selfReferenceRuleKey) {
					throw new Error("Invalid key " + key + ". Only the self-reference key (" + config.selfReferenceRuleKey) + ") can be used to specify validation rules for a Backbone.Collection";
				}
				validator = new Validator(key, ruleBuilder.rules);
				this.validators.push(validator);
			}, this);
		},
		validate: function (attributes, options, context) {
			var builder = new ResultBuilder();
			var values;
			// Any validators will validate entire collection (rules can check 
			// for unique values, totals etc)
			for (var i = 0, l = this.validators.length; i < l; i++) {
				values = this.validators[i].validate(attributes, options, context);
				builder.add(values);
			}
			this.validateModels(options, context, builder);
			return builder.getResult();
		},
		validateModels: function (options, context, builder) {
			var modelContext;
			var models = context.target.models;
			for (var i = 0, l = models.length; i < l; i++) {
				var model = models[i];
				if (model && _.isFunction(model.validate)) {
					modelContext = _.clone(context);
					modelContext.target = model;
					modelContext.path = config.pathFormatter.appendCollectionItem(context.path, i);

					var result = model.validate(null, options, modelContext);
					if (result && _.isArray(result.invalidValues)) {
						builder.add(result.invalidValues);
					}
				}
			}
		}
	});

	// Used during validation to combine invalid values from different validators
	// and generate the final Result
	var ResultBuilder = function () {
		this.map = {};
	};
	_.extend(ResultBuilder.prototype, {
		add: function (items) {
			for (var i = 0, l = items.length; i < l; i++) {
				var item = items[i];
				if (_.has(this.map, item.path)) {
					this.map[item.path].errors.push(item.errors);
				} else {
					this.map[item.path] = item;
				}
			}
		},
		getResult: function () {
			return new Result(_.values(this.map));
		}
	});

	// Result of validating a model
	var Result = function (invalidValues) {
		this.invalidValues = invalidValues;
		this.isValid = invalidValues.length === 0;
	};
	_.extend(Result.prototype, {
		// Summary of result suitable for logging / diagnostics
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
	// Validates one or more attribute values using the specified rules
	var Validator = function (key, rules) {
		this.initialize(key);
		this.rules = rules;
	};
	_.extend(Validator.prototype, {
		initialize: function (key) {
			if (key.indexOf(config.multiAttributeKeySeparator) != -1) {
				this.keys = key.split(config.multiAttributeKeySeparator);
			} else {
				this.keys = [key];
			}
		},
		validate: function (attributes, options, context) {
			var specifiedKeys = this.getSpecifiedKeys(attributes);
			if (specifiedKeys.length === 0) {
				return emptyArray;
			}
			var values = this.getValues(attributes, context);
			if (values.length !== this.keys.length) {
				return emptyArray;
			}
			var invalidValues = [];
			for (var i = 0, l = specifiedKeys.length; i < l; i++) {
				this.testRules(specifiedKeys[i], values, invalidValues, options, context);
			}
			return invalidValues;
		},
		getSpecifiedKeys: function (attributes) {
			return _.filter(this.keys, function (key) {
				if (key === config.selfReferenceRuleKey) {
					// We can always validate target object
					return true;
				}
				// we should validate if one of values is in
				// attributes specified
				return _.has(attributes, key);
			});
		},
		getValues: function (attributes, context) {
			var values = [];
			_.each(this.keys, function (key) {
				if (key === config.selfReferenceRuleKey) {
					values.push(context.target);
				} else if (_.has(attributes, key)) {
					values.push(attributes[key]);
				} else if (context.target.has(key)) {
					values.push(context.target.get(key));
				}
			});
			return values;
		},
		testRules: function (key, values, invalidValues, options, context) {
			var i, l, result;
			context = _.clone(context);
			context.path = config.pathFormatter.appendAttribute(context.path, key);
			for (i = 0, l = this.rules.length; i < l; i++) {
				result = this.rules[i].test(key, values, options, context);
				invalidValues.push.apply(invalidValues, result);
			}
		}
	});
	
	// Rules
	// --------------

	// Each rule type contains a "test" function that returns an array of invalid values

	// Simple validation rule that validates the value(s) using an isValid delegate.
	var SimpleRule = function (isValid, options, key) {
		this.isValid = isValid;
		this.options = options || {};
		this.key = key || "";
	};

	_.extend(SimpleRule.prototype, {
		test: function (key, values, options, context) {
			// isValid arguments combine value(s) and context
			var args = values.slice();
			args.push(context);
			var result = this.isValid.apply(this, args);
			// Truthy result means values are valid
			if (result) {
				return emptyArray;
			} else {
				var message = this.options.message || messageBuilder.createMessage(this, context);
				var invalidValue = {
					attr: key,
					path: context.path,
					errors: [{ message: message, key: this.key}]
				};
				return [invalidValue];
			}
		}
	});

	// Requires that a nested model or collection is valid
	var NestedObjectRule = function (options, key) {
		this.options = options || {};
		this.key = key || "";
	};

	_.extend(NestedObjectRule.prototype, {
		test: function (key, values, options, context) {
			var target = values[0];
			if (_.isFunction(target.validate)) {
				var result = target.validate(null, options, context);
				return result ? result.invalidValues : emptyArray;
			} else {
				return emptyArray;
			}
		}
	});

	// RuleBuilder - Used to configure rules
	// RuleBuilders are immutable. Each rule method returns a new instance with the additional rule.
	var RuleBuilder = function (rules) {
		this.rules = rules || [];
	};

	_.extend(RuleBuilder.prototype, {
		addRule: function (rule) {
			var newRules = this.rules.slice();
			newRules.push(rule);
			return new RuleBuilder(newRules);
		},
		addSimpleRule: function (isValid, options, key) {
			var rule = new SimpleRule(isValid, options, key);
			return this.addRule(rule);
		},
		// value cannot be null or undefined
		notNull: function (options) {
			return this.addSimpleRule(function (value) {
				return !isNullOrUndefined(value);
			}, options, "not-null");
		},
		// all characters in value must be numeric
		numeric: function (options) {
			return this.addSimpleRule(function (value) {
				if (isNullOrUndefined(value)) {
					return true;
				}
				return /^\d*$/.test(value);
			}, options, "numeric");
		},
		// value cannot be null or undefined
		range: function (options) {
			var values = options.values || {};
			return this.addSimpleRule(function (value) {
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
			return this.addSimpleRule(function (value) {
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
			return this.addSimpleRule(function (value) {
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
			return this.addSimpleRule(function (value) {
				if (!_.isString(value))
					return false;
				if (options.trim)
					value = trimString(value);
				return /^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+([A-Z]{2,4}|museum)$/i.test(value);
			}, options, "email");
		},
		// sequence of ruleBuilders and optional options as final arg
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
			return this.addSimpleRule(isValid, args.options);
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
			return this.addSimpleRule(isValid, args.options);
		},
		// custom check using a callback function. The function will be invoked with
		// 2 arguments (value, context) - the context contains the name of the attr
		// and the parent model if available
		check: function (func, options) {
			return this.addSimpleRule(function (value, context) {
				return func(value, context);
			}, options, "check");
		},
		// tests whether a nested model or collection is valid (using its own validate method) 
		// and includes any invalidValues in the result
		valid: function (options) {
			var rule = new NestedObjectRule(options, "child-model");
			return this.addRule(rule);
		}
	});


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
	// Model extensions

	var initValidator = function (target) {
		if (!target.validator) {
			var targetConfig = {
				rules: target.rules
			};
			if (target instanceof Backbone.Model) {
				target.validator = new ModelValidator(targetConfig);
			}
			else if (target instanceof Backbone.Collection) {
				target.validator = new CollectionValidator(targetConfig);
			}
		}
		return target.validator;
	};

	// Mixin that extends Model or Collection with validation functionality
	var modelValidation = {
		validate: function (attributes, options, context) {
			attributes || (attributes = this.attributes);
			var validator = initValidator(this);
			context = _.isObject(context) ? _.clone(context) : { path: "" };
			_.extend(context, {
				options: options,
				target: this
			});
			var result = validator.validate(attributes, options, context);
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





