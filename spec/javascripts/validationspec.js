describe("model validation", function () {
	var f = JSON.stringify; // format objects in messages

	var ModelValidator = Backbone.validation.ModelValidator;
	var rules = Backbone.validation.rules;

	describe("model extensions", function () {

		var BaseModel = Backbone.Model.extend(Backbone.validation.modelExtensions);
		var TestModel = BaseModel.extend({
			validation: {
				attrs: {
					code: rules.length({ min: 2, max: 5, message: "Between 2 and 5" })
				},
				instance: rules.check(function (model, context){ })
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
			var expectedResult = {
				isValid: false,
				results: [{ attr: "code", path: "code", errors: [{ message: "Between 2 and 5", key: "string-length"}]}]
			};
			expect(validationResult).toEqual(expectedResult);
		});

		it("should not trigger error if valid attribute set", function () {
			var errored = false;
			model.bind("error", function (m, r) {
				errored = true;
			});
			model.set({ code: "1" });
			expect(validationResult).not.toBeNull();
			var expectedResult = {
				isValid: false,
				results: [{ attr: "code", path: "code", errors: [{ message: "Between 2 and 5", key: "string-length"}]}]
			};
			expect(validationResult).toEqual(expectedResult);
		});

	});

	describe("model validation", function () {

		var validator;

		beforeEach(function () {
			this.addMatchers({
				toBeValid: function () {
					var result = this.actual;
					this.message = function () {
						return "Expected model to be valid but result was as follows: \n" + f(result);
					};
					return result.isValid;
				},
				toBeInvalid: function () {
					var result = this.actual;
					this.message = function () {
						return "Expected model to be invalid but result was as follows: \n" + f(result);
					};
					return !result.isValid;
				}
			});

			validator = new ModelValidator({
				code: rules.length({ min: 2, max: 5, message: "Between 2 and 5" }),
				name: rules.length({ min: 2, max: 5, message: "Between 2 and 5" }),
				description: rules.notNull({ message: "Not null" })
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

		it("should describe each invalid attr", function () {
			var result = validator.validateAttrs({ code: "123", name: "1", description: null });
			expect(result.results).toEqual([
				{ attr: "name", path: "name", errors: [{ message: "Between 2 and 5", key: "string-length"}] },
				{ attr: "description", path: "description", errors: [{ message: "Not null", key: "not-null"}] }
			]);

		});

	});


	describe("nested object validation", function () {

		var Person = Backbone.Model.extend();

		var dave, mary, validator;

		beforeEach(function () {
			validator = new ModelValidator();
			validator.attr("spouse").valid(function (child) {
				child.attr("name");
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

	describe("validation rules", function () {

		var TestModel = Backbone.Model.extend();

		var model, validator;

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
						if (result.results.length === 1) {
							var actualMessages = _.pluck(result.results[0].errors, "message");
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
					validator = new ModelValidator({ name: rules.notNull() });
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid();
				});

				it("string value is valid", function () {
					expect("Dave").toBeValid();
				});

				it("number is valid", function () {
					expect(123).toBeValid();
				});

				it("should use default message", function () {
					expect(null).toBeInvalid(["Please supply a value"]);
				});
			});

			describe("not null - custom message", function () {

				beforeEach(function () {
					validator = new ModelValidator({
						name: rules.notNull({ message: "Value please!" })
					});
				});

				it("should use default message", function () {
					expect(null).toBeInvalid(["Value please!"]);
				});
			});

			describe("range", function () {

				beforeEach(function () {
					validator = new ModelValidator({
						name: rules.range({ values: ["male", "female"] })
					});
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid();
				});

				it("expected values are valid", function () {
					expect("male").toBeValid();
					expect("female").toBeValid();
				});

				it("unspecified values are not valid", function () {
					expect("Male").toBeInvalid();
					expect("MALE").toBeInvalid();
					expect("pending").toBeInvalid();
					expect("tbc").toBeInvalid();
				});
			});

			describe("range - ignore case", function () {

				beforeEach(function () {
					validator = new ModelValidator({
						name: rules.range({ values: ["male", "female"], ignoreCase: true })
					});
				});

				it("expected values in any case are valid", function () {
					expect("male").toBeValid();
					expect("MALE").toBeValid();
					expect("FEMALE").toBeValid();
					expect("female").toBeValid();
				});

				it("unspecified values are not valid", function () {
					expect("unsure").toBeInvalid();
					expect("not bothered").toBeInvalid();
				});
			});

		});

		describe("string attr rules", function () {

			describe("not blank", function () {
				beforeEach(function () {
					validator = new ModelValidator({ name: rules.notBlank() });
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid();
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid();
				});

				it("spaces only is invalid", function () {
					expect("   ").toBeInvalid();
				});

				it("tabs only is invalid", function () {
					expect("\t\t").toBeInvalid();
				});

				it("non-empty string value is valid", function () {
					expect("Dave").toBeValid();
				});

				it("number is valid", function () {
					expect(123).toBeValid();
				});
			});

			describe("length - min only", function () {

				beforeEach(function () {
					validator = new ModelValidator({ name: rules.length({ min: 2 }) });
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid();
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid();
				});

				it("min length spaces only is valid", function () {
					expect("  ").toBeValid();
				});

				it("min length string value is valid", function () {
					expect("ab").toBeValid();
				});

				it("min length number is valid", function () {
					expect(12).toBeValid();
				});

				it("below min length number is invalid", function () {
					expect(1).toBeInvalid();
				});
			});

			describe("length - max only", function () {

				beforeEach(function () {
					validator = new ModelValidator({ name: rules.length({ max: 5 }) });
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid();
				});

				it("empty string is valid", function () {
					expect("").toBeValid();
				});

				it("below max length spaces only is valid", function () {
					expect("     ").toBeValid();
				});

				it("string above max length is invalid", function () {
					expect("Daveasdfasf").toBeInvalid();
				});

				it("number below max length is valid", function () {
					expect(12345).toBeValid();
				});

				it("number above max length is invalid", function () {
					expect(123456).toBeInvalid();
				});
			});

			describe("length - min only trimmed", function () {

				beforeEach(function () {
					validator = new ModelValidator({ name: rules.length({ min: 2, trim: true }) });
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid();
				});

				it("min length spaces only is invalid", function () {
					expect("  ").toBeInvalid();
				});

				it("min length tabs only is invalid", function () {
					expect("\t\t").toBeInvalid();
				});

				it("insufficient length when trimmed is invalid", function () {
					expect("  A  ").toBeInvalid();
				});

				it("min length string value is valid", function () {
					expect("ab").toBeValid();
				});

				it("min length number is valid", function () {
					expect(12).toBeValid();
				});
			});

			describe("length - min and max trimmed", function () {

				beforeEach(function () {
					validator = new ModelValidator({
						name: rules.length({ min: 2, max: 5, trim: true })
					});
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid();
				});

				it("min length spaces only is invalid", function () {
					expect("  ").toBeInvalid();
				});

				it("min length tabs only is invalid", function () {
					expect("\t\t").toBeInvalid();
				});

				it("below min length when trimmed is invalid", function () {
					expect("  A  ").toBeInvalid();
					expect("     A").toBeInvalid();
					expect("A    ").toBeInvalid();
				});

				it("above max length when trimmed is invalid", function () {
					expect("  AAAAAA  ").toBeInvalid();
					expect("     AAAAAAA").toBeInvalid();
					expect("AAAAAAA    ").toBeInvalid();
				});

				it("within min and max when trimmed is valid", function () {
					expect("  AAAA   ").toBeValid();
				});

				it("within min and max is valid", function () {
					expect("ab").toBeValid();
					expect("abc").toBeValid();
					expect("abcd").toBeValid();
					expect("abcde").toBeValid();
				});

				it("number within min and max is valid", function () {
					expect(12).toBeValid();
					expect(123).toBeValid();
					expect(1234).toBeValid();
					expect(12345).toBeValid();
				});
			});

			describe("custom check", function () {

				beforeEach(function () {
					validator = new ModelValidator({
						name: rules.check(function (value, context) {
							return value.toString().indexOf("monkey") != -1;
						}, { message: "Needs to contain the word monkey" })
					});
				});

				it("value not matching rule is invalid", function () {
					expect("asdf").toBeInvalid();
				});

				it("value matching rule is valid", function () {
					expect("monkey man").toBeValid();
				});
			});
		});
	});


});