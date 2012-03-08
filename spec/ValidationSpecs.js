describe("model validation", function () {
	var f = JSON.stringify; // format objects in messages

	var ModelValidator = Backbone.validation.ModelValidator;
	var rules = Backbone.validation.rules;

	var createValidator = function (rulesConfig) {
		return new ModelValidator({ rules: rulesConfig });
	};

	describe("model validation extension", function () {

		var BaseModel = Backbone.Model.extend(Backbone.validation.modelValidation);
		var TestModel = BaseModel.extend({
			rules: {
				code: rules.length({ min: 2, max: 5, message: "Between 2 and 5" })
			}
		});
		var model;
		beforeEach(function () {
			model = new TestModel();
		});

		it("should trigger error if invalid attribute is set", function () {
			var validationResult = null;
			model.bind("error", function (m, r) {
				validationResult = r;
			});
			model.set({ code: "1" });
			expect(validationResult).not.toBeNull();
			var expected = [{ attr: "code", path: "code", errors: [{ message: "Between 2 and 5", key: "string-length"}]}];
			expect(validationResult.invalidValues).toEqual(expected);
		});

		it("should not trigger error if invalid attribute is set silently", function () {
			var errored = false;
			model.bind("error", function (m, r) {
				errored = true;
			});
			model.set({ code: "1" }, { silent: true });
			expect(errored).toBeFalsy();
		});


		it("model should be invalid after attribute is set silently", function () {
			var errored = false;
			model.bind("error", function (m, r) {
				errored = true;
			});
			model.set({ code: "1" }, { silent: true });
			expect(errored).toBeFalsy();
			var result = model.validate();
			expect(result).not.toBeNull();
		});

		it("should not trigger error if valid attribute set", function () {
			var errored = false;
			model.bind("error", function (m, r) {
				errored = true;
			});
			model.set({ code: "123" });
			expect(errored).toBeFalsy();
		});

	});

	describe("model validation", function () {

		describe("when validating specific attributes", function () {

			var validator;

			beforeEach(function () {
				validator = createValidator({
					code: rules.length({ min: 2, max: 5, message: "Between 2 and 5" }),
					name: rules.length({ min: 2, max: 5, message: "Between 2 and 5" }),
					description: rules.notNull({ message: "Not null" })
				});

				this.addMatchers({
					toBeValid: function () {
						var result = this.actual;
						this.message = function () {
							return "Expected result to be valid but result was as follows: \n" + f(result);
						};
						return result.isValid;
					},
					toBeInvalid: function () {
						var result = this.actual;
						this.message = function () {
							return "Expected result to be invalid but result was as follows: \n" + f(result);
						};
						return !result.isValid;
					}
				});
			});

			it("should be valid if single attr being tested is valid", function () {
				var result = validator.validateAttrs({ code: "123" });
				expect(result).toBeValid();
			});

			it("should be valid if all attrs being tested are valid", function () {
				var result = validator.validateAttrs({ code: "123", name: "123" });
				expect(result).toBeValid();
			});

			it("should be invalid if one of all attrs being tested is invalid", function () {
				var result = validator.validateAttrs({ code: "1", name: "123" });
				expect(result).toBeInvalid();
			});

			it("should describe each invalid value", function () {
				var result = validator.validateAttrs({ code: "123", name: "1", description: null });
				expect(result.invalidValues).toEqual([
						{ attr: "name", path: "name", errors: [{ message: "Between 2 and 5", key: "string-length"}] },
						{ attr: "description", path: "description", errors: [{ message: "Not null", key: "not-null"}] }
					]);
			});

		});

		describe("when creating model with validation rules", function () {

			var BaseModel = Backbone.Model.extend(Backbone.validation.modelValidation);
			var TestModel = BaseModel.extend({
				rules: {
					self: rules.check(function (model) {
						return model.get("start") < model.get("end");
					}, { message: "Start must be less than end" }),
					start: rules.numeric(),
					end: rules.numeric()
				}
			});

			beforeEach(function () {
				this.addMatchers({
					toBeValid: function () {
						var model = this.actual;
						var result = model.validate();
						this.message = function () {
							return "Expected model to be valid but result was as follows: \n" + f(result);
						};
						return !result;
					},
					toBeInvalid: function () {
						var model = this.actual;
						var result = model.validate();
						this.message = function () {
							return "Expected model to be invalid but it was valid";
						};
						return result;
					}
				});
			});

			it("should be valid if attributes satisfy all rules", function () {
				expect(new TestModel({ start: "1", end: "2" })).toBeValid();
			});

			it("should be invalid if one of attributes is invalid", function () {
				expect(new TestModel({ start: "1", end: "a" })).toBeInvalid();
			});
			
			it("should be invalid if attributes do not satisfy model level (self) rule", function () {
				expect(new TestModel({ start: "3", end: "1" })).toBeInvalid();
			});
			

		});


		describe("TODO nested object validation", function () {

			var Person = Backbone.Model.extend();

			var dave, mary, validator;

			beforeEach(function () {
				validator = createValidator({
					spouse: rules.valid({})
				});

				dave = new Person({ firstName: "Dave", lastName: "Smith", gender: "male" });
				mary = new Person({ firstName: "Mary", lastName: "Smith", gender: "female", spouse: dave });
			});

			describe("when validating nested model", function () {

				beforeEach(function () {
					validator.attr("name").valid();
				});

			});


			describe("nested collections", function () {

			});
		});
	});




	describe("validation rules", function () {

		var TestModel = Backbone.Model.extend();

		var model, validator;

		var valid = function (value, description) {
			test(value, true, description);
		};

		var invalid = function (value, description) {
			test(value, false, description);
		};

		var test = function (val, shouldBeValid, description) {
			var values = _.isArray(val) ? val : [val];
			_.each(values, function (value) {
				var valueDescription;
				if (_.isNull(value)) {
					valueDescription = "null";
				}
				else if (_.isUndefined(value)) {
					valueDescription = "undefined";
				}
				else if (_.isString(value)) {
					valueDescription = "'" + value + "'";
				} else {
					valueDescription = value.toString();
				}
				if (description) {
					valueDescription += " - " + description + " - ";
				}
				var testDescription = valueDescription + " should" + (shouldBeValid ? "" : " not") + " be valid";
				it(testDescription, function () {
					if (shouldBeValid) {
						expect(value).toBeValid();
					} else {
						expect(value).toBeInvalid();
					}
				});

			});
		};

		beforeEach(function () {
			model = new TestModel();

			this.addMatchers({
				toBeValid: function () {
					model.set({ name: this.actual });
					var result = validator.validate(model);
					this.message = function () {
						return "Expected model to be valid but result was as follows: \n" + f(result);
					};
					return result.isValid;

				},
				toBeInvalid: function (expectedMessages) {
					model.set({ name: this.actual });
					var result = validator.validate(model);
					this.message = function () {
						var message = "Expected model to be invalid";
						if (expectedMessages) {
							message += " with messages: " + f(expectedMessages);
						}
						message += " but result was as follows: \n" + f(result);
						return message;
					};
					var messagesOk = true;
					if (expectedMessages) {
						if (result.invalidValues.length === 1) {
							var actualMessages = _.pluck(result.invalidValues[0].errors, "message");
							messagesOk = _.isEqual(actualMessages, expectedMessages);
						} else {
							messagesOk = false;
						}
					}
					return !result.isValid && messagesOk;
				}
			});
		});

		describe("object attr rules", function () {

			describe("not null", function () {

				beforeEach(function () {
					validator = createValidator({ name: rules.notNull() });
				});

				invalid(null);
				valid("Dave", "string value");
				valid(123, "number");

				it("should use default message", function () {
					expect(null).toBeInvalid(["Please supply a value"]);
				});
			});

			describe("not null - custom message", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.notNull({ message: "Value please!" })
					});
				});

				it("should use custom message", function () {
					expect(null).toBeInvalid(["Value please!"]);
				});
			});

			describe("range", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.range({ values: ["male", "female"] })
					});
				});

				invalid(null);
				valid(["male", "female"], "specified value");
				invalid(["Male", "MALE", "pending", "tbc"], "unspecified value");
			});

			describe("range - ignore case", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.range({ values: ["male", "female"], ignoreCase: true })
					});
				});

				valid(["male", "female", "MALE", "FEMALE"], "specified value");
				invalid(["pending", "tbc"], "unspecified value");
			});

		});

		describe("string attr rules", function () {

			describe("not blank", function () {
				beforeEach(function () {
					validator = createValidator({
						name: rules.notBlank()
					});
				});

				invalid(null);
				invalid(["", "   ", "\t\t"], "empty or whitespace only");
				valid(["Dave", 123]);
			});

			describe("numeric", function () {
				beforeEach(function () {
					validator = createValidator({
						name: rules.numeric()
					});
				});

				valid([null, ""], "null or empty values");
				invalid(["abc", "1d", "\t\t"]);
				valid(["12345", 123, "00000000000", 99]);
			});

			describe("length - exact", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.length({ exact: 5 })
					});
				});

				invalid([null, "1234", 1234, "123456"]);
				valid(["jjjjj", "abcde", 12345]);
			});

			describe("length - min only", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.length({ min: 2 })
					});
				});

				invalid([null, "", 1]);
				valid(["  ", "ab", 12]);
			});

			describe("length - max only", function () {

				beforeEach(function () {
					validator = createValidator({ name: rules.length({ max: 5 }) });
				});

				invalid([null, "      ", "askjdflaskdf", 123456]);
				valid(12345, "hello", "1", "");
			});

			describe("length - min only trimmed", function () {

				beforeEach(function () {
					validator = createValidator({ name: rules.length({ min: 2, trim: true }) });
				});

				invalid(["", "  ", "\t\t", "  A  "]);
				valid("ab", 12);
			});

			describe("length - min and max trimmed", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.length({ min: 2, max: 5, trim: true })
					});
				});

				invalid(["", "  ", "\t\t", "  A  ", "     A", "A     ", "  AAAAAA  ", "     AAAAAAA", "AAAAAAA    "]);
				valid(["ab", "abc", "abcd", "abcde", "  AAAA   ", "AAAA   ", 12, 123, 1234, 12345]);
			});

			describe("email - trimmed", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.email({ trim: true })
					});
				});

				invalid(["dan", "dan@", "dan@..com", "dan@.com", "", "dan@gmail.badtld"]);
				valid([" dan@gmail.com", " dan@gmail.com  ", "dan@gmail.com  ", "dan@gmail.asia", "dan@asdfsdf.museum", "dan@company.co.uk"]);
			});

			describe("custom check", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.check(function (value, context) {
							return value.toString().indexOf("monkey") != -1;
						}, { message: "Needs to contain the word monkey" })
					});
				});

				invalid("asdf", "not matching rule");
				valid("monkey man", "matching rule");
			});

			describe("any", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.any(rules.numeric().length({ exact: 6 }), rules.length({ min: 10, max: 12 }),
							{ message: "6 digit account number or username of 10 to 15 characters" })
					});
				});

				invalid(["12345", "1234567", "asdfasdddadffffffffff.", "asd"]);
				valid([123456, "123456", "chieftain600", "chieftain6"]);

				it("should combine messages", function () {
					// TODO: "message1 or message2"

				});
			});

			describe("any - custom message", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.any(rules.numeric().length({ exact: 6 }), rules.length({ min: 10, max: 12 }),
							{ message: "6 digit account number or username of 10 to 15 characters" })
					});
				});

				it("should use messages", function () {
					expect("12").toBeInvalid(["6 digit account number or username of 10 to 15 characters"]);
				});
			});

			describe("combine", function () {

				beforeEach(function () {
					validator = createValidator({
						name: rules.combine(rules.numeric(), rules.length({ exact: 6 }),
							{ message: "6 digit account number" })
					});
				});

				invalid(["12345", "1234567", "asdfas", null]);
				valid([123456, "123456"]);

				it("should combine messages", function () {
					// TODO: "message1 and message2"
					//expect(null).toBeInvalid([""]);
				});
			});
		});
	});


});