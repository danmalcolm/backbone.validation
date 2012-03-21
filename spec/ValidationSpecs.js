describe("model validation", function () {
	var f = JSON.stringify; // format objects in messages

	var ModelValidator = Backbone.validation.ModelValidator;
	var rules = Backbone.validation.rules;

	var createValidator = function (rulesConfig) {
		return new ModelValidator({ rules: rulesConfig });
	};

	// Model extended with modelValidation mixin
	var BaseModel = Backbone.Model.extend(Backbone.validation.modelValidation);


	describe("model validation extension", function () {

		var Model = BaseModel.extend({
			rules: {
				code: rules.length({ min: 2, max: 5, message: "Between 2 and 5" })
			}
		});
		var model;
		beforeEach(function () {
			model = new Model();
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

		var model;

		beforeEach(function () {

			this.addMatchers({
				// Validates an object specifying attribute values against the current model
				toBeValid: function () {
					var result = model.validate(this.actual);
					this.message = function () {
						return "Expected attributes to be valid (ie no result) but result was returned: \n" + f(result);
					};
					return !result;
				},
				// Validates an object specifying attribute values against the current model
				toBeInvalid: function (invalidValues) {
					var result = model.validate(this.actual);

					this.message = function () {
						if (!result) {
							return "Expected attributes to be invalid but no result was returned by model.validate, which indicates that values are valid";
						} else {
							var message = "Expected validation to fail";
							if (invalidValues) {
								message += " with invalid values: " + f(invalidValues);
							}
							message += " but invalid values were as follows: \n" + f(result.invalidValues);
							return message;
						}
					};
					return result
						&& !result.isValid
						&& (!invalidValues || _.isEqual(result.invalidValues, invalidValues));
				}
			});
		});

		describe("when validating attributes using model", function () {

			var Model = BaseModel.extend({
				rules: {
					code: rules.length({ min: 2, max: 5, message: "Between 2 and 5" }),
					name: rules.length({ min: 2, max: 5, message: "Between 2 and 5" }),
					description: rules.notNull({ message: "Not null" })
				}
			});

			beforeEach(function () {
				model = new Model();
			});

			it("should be valid if single attr being tested is valid", function () {
				expect({ code: "123" }).toBeValid();
			});

			it("should be valid if all attrs being tested are valid", function () {
				expect({ code: "123", name: "123" }).toBeValid();
			});

			it("should be invalid if one of multiple attrs being tested is invalid", function () {
				expect({ code: "1", name: "123" }).toBeInvalid();
			});

			it("should describe each invalid value", function () {
				var result = model.validate({ code: "123", name: "1", description: null });
				expect(result.invalidValues).toEqual([
						{ attr: "name", path: "name", errors: [{ message: "Between 2 and 5", key: "string-length"}] },
						{ attr: "description", path: "description", errors: [{ message: "Not null", key: "not-null"}] }
					]);
			});

		});

		describe("nested model validation", function () {

			var Order = BaseModel.extend({
				rules: {
					customer: rules.validate({ message: "Customer should be valid" })
				}
			});

			var Customer = BaseModel.extend({
				rules: {
					name: rules.length({ min: 2, message: "At least 2" }),
					address: rules.validate({ message: "Customer's address should be valid"})
				}
			});

			var Address = BaseModel.extend({
				rules: {
					line1: rules.length({ min: 2, message: "At least 2" })
				}
			});

			beforeEach(function () {
				model = new Order();
			});

			describe("when setting invalid attribute on nested model", function () {

				it("should fail validation with full path to invalid values", function () {
					expect({ customer: new Customer({ name: "X", address: new Address({ line1: "1 My Street" }) }) }).toBeInvalid([
						{ attr: "name", path: "customer.name", errors: [{ message: "At least 2", key: "string-length"}] }
					]);
				});

			});

			describe("when setting invalid attribute on model nested 2 levels deep", function () {

				it("should fail validation with full path to invalid values", function () {
					expect({ customer: new Customer({ name: "Mike", address: new Address({ line1: "X" }) }) }).toBeInvalid([
						{ attr: "line1", path: "customer.address.line1", errors: [{ message: "At least 2", key: "string-length"}] }
					]);
				});

			});

		});

		// Rules that validate single value
		describe("when testing rules applied to single attribute values", function () {

			var Model = BaseModel.extend({
				rules: {
					start: rules.numeric(),
					end: rules.numeric()
				}
			});

			beforeEach(function () {
				model = new Model();
			});

			it("should be valid if single attribute specified is valid", function () {
				expect({ start: 1 }).toBeValid();
				expect({ end: 1 }).toBeValid();
			});

			it("should be valid if all attributes specified are valid", function () {
				expect({ start: 1, end: 2 }).toBeValid();
			});

			it("should be invalid if one of many attributes specified is invalid", function () {
				expect({ start: 1, end: "a" }).toBeInvalid();
			});

		});

		describe("when testing rules that apply to multiple attributes", function () {

			var tested;
			var args;
			var Model = BaseModel.extend({
				rules: {
					start: rules.numeric(),
					end: rules.numeric(),
					"start,end": rules.check(function (start, end) {
						tested = true;
						args = _.clone(arguments);
						return start < end;
					}, { message: "Start must be less than end" })
				}
			});

			beforeEach(function () {
				model = new Model();
				tested = false;
				args = [];
			});

			describe("rule application", function () {

				it("should test rule and succeed if all values specified and they are valid", function () {
					expect({ start: 1, end: 2 }).toBeValid();
					expect(tested).toBeTruthy();
				});

				it("should test rule and fail if all values specified and they are invalid", function () {
					expect({ start: 2, end: 1 }).toBeInvalid();
					expect(tested).toBeTruthy();
				});

				it("should test rule and succeed if one value specified and other on model and they are valid", function () {
					model.set("start", 1, { silent: true });
					expect({ end: 2 }).toBeValid();
					expect(tested).toBeTruthy();
					expect(args[0]).toEqual(1);
					expect(args[1]).toEqual(2);
				});

				it("should not test rule if no values specified", function () {
					model.validate({ other: "" });
					expect(tested).toBeFalsy();
				});

				it("should not test rule if only one of values is specified", function () {
					model.validate({ start: 1 });
					expect(tested).toBeFalsy();
				});

				it("should not test rule if no values specified, even if they exist on model", function () {
					model.set({ start: 1, end: 2 }, { silent: true });
					model.validate({ other: "" });
					expect(tested).toBeFalsy();
				});

				it("should test and succeed if combination of specified value and model attribute satisfies rule", function () {
					model.set("start", 1, { silent: true });
					expect({ end: 2 }).toBeValid();
					expect(tested).toBeTruthy();
				});

				// TODO - is this actually a good thing
				it("should not test rule if one of values specified fails validation at individual attribute level", function () {
					//					expect({ start: 1, end: "a" }).toBeInvalid();
					//					expect(tested).toBeFalsy();
				});

				// TODO - is this actually a good thing
				it("should not test rule if model attribute fails validation at individual attribute level", function () {
					//					model.set("start", "a", { silent: true });
					//					expect({ end: 3 }).toBeInvalid();
					//					expect(tested).toBeFalsy();
				});

			});

			describe("test function invocation", function () {

				it("should invoke rule function with values specified", function () {
					expect({ start: 1, end: 2 }).toBeValid();
					expect(tested).toBeTruthy();
					expect(args[0]).toEqual(1);
					expect(args[1]).toEqual(2);
				});

				it("should invoke function with combination of specified values and model attributes", function () {
					model.set("start", 1, { silent: true });
					expect({ end: 2 }).toBeValid();
					expect(tested).toBeTruthy();
					expect(args[0]).toEqual(1);
					expect(args[1]).toEqual(2);
				});

			});

			describe("results", function () {

				it("when validating all specified values should create error message for each attribute", function () {
					expect({ start: 3, end: 1 }).toBeInvalid([
						{ attr: "start", path: "start", errors: [{ message: "Start must be less than end", key: "check"}] },
						{ attr: "end", path: "end", errors: [{ message: "Start must be less than end", key: "check"}] }
					]);
				});

				it("when validating combination of specified values and model attributes should only create error message for specified attribute", function () {
					model.set("start", 3, { silent: true });
					expect({ end: 1 }).toBeInvalid([
						{ attr: "end", path: "end", errors: [{ message: "Start must be less than end", key: "check"}] },
					]);
				});

			});

		});

	});




	describe("validation rules", function () {

		var TestModel = Backbone.Model.extend(Backbone.validation.modelValidation);

		var validator, model;

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
					var result = validator.validate({ name: this.actual }, { target: new Backbone.Model(), path: "" });
					this.message = function () {
						return "Expected model to be valid but result was as follows: \n" + f(result);
					};
					return result.isValid;

				},
				toBeInvalid: function (expectedMessages) {
					var result = validator.validate({ name: this.actual }, { target: new Backbone.Model(), path: "" });
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