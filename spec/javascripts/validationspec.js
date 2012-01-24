describe("model validation", function () {
	var f = JSON.stringify; // format objects in messages


	// TODO - mixin 
	describe("model extensions", function () {

		var TestModel = Backbone.Model.extend({
			initValidator: function (validator) {
				validator.attr("name").length({ min: 2, max: 5 });
			}
		});

		beforeEach(function () {

		});

		it("should return result if not valid", function () {

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

			validator = new Backbone.validation.ModelValidator();
			validator.attr("code").length({ min: 2, max: 5 }, "Between 2 and 5");
			validator.attr("name").length({ min: 2, max: 5 }, "Between 2 and 5");
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

	});


	describe("nested object validation", function () {

		var TestModel = Backbone.Model.extend();

		var model, validator;

		beforeEach(function () {
			validator = new Backbone.validation.ModelValidator();
			model = new Person();
		});

		describe("when validating nested model", function () {

			beforeEach(function () {
				validator.attr("name").valid();
			});

		});


		describe("nested collections", function () {

		});
	});

	describe("attr validation rules", function () {

		var TestModel = Backbone.Model.extend();

		var model, validator;

		beforeEach(function () {
			validator = new Backbone.validation.ModelValidator();
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
				toBeInvalid: function () {
					model.set({ name: this.actual });
					var result = validator.validate(model);
					this.message = function () {
						return "Expected model to be invalid but result was as follows: \n" + f(result);
					};
					return !result.isValid;
				}
			});
		});

		describe("object attr rules", function () {

			describe("not null", function () {

				beforeEach(function () {
					validator.attr("name").notNull("Needs a name");
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid();
				});

				it("string value is valid", function () {
					expect("Dave").toBeValid();
				});

				it("number is valid", function () {
					expect(123).toBeValid(model);
				});
			});

		});

		describe("string attr rules", function () {
			describe("not blank", function () {
				beforeEach(function () {
					validator.attr("name").notBlank("Needs a name");
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid(model);
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid(model);
				});

				it("spaces only is invalid", function () {
					expect("   ").toBeInvalid(model);
				});

				it("tabs only is invalid", function () {
					expect("\t\t").toBeInvalid(model);
				});

				it("non-empty string value is valid", function () {
					expect("Dave").toBeValid(model);
				});

				it("number is valid", function () {
					expect(123).toBeValid(model);
				});
			});

			describe("length - min only", function () {

				beforeEach(function () {
					validator.attr("name").length({ min: 2 }, "Needs a name of at least 2 characters");
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid(model);
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid(model);
				});

				it("min length spaces only is valid", function () {
					expect("  ").toBeValid(model);
				});

				it("min length string value is valid", function () {
					expect("ab").toBeValid(model);
				});

				it("min length number is valid", function () {
					expect(12).toBeValid(model);
				});

				it("below min length number is invalid", function () {
					expect(1).toBeInvalid(model);
				});
			});

			describe("length - max only", function () {

				beforeEach(function () {
					validator.attr("name").length({ max: 5 }, "Needs a name of up to 5 characters");
				});

				it("null is invalid", function () {
					expect(null).toBeInvalid(model);
				});

				it("empty string is valid", function () {
					expect("").toBeValid(model);
				});

				it("below max length spaces only is valid", function () {
					expect("     ").toBeValid(model);
				});

				it("string above max length is invalid", function () {
					expect("Daveasdfasf").toBeInvalid(model);
				});

				it("number below max length is valid", function () {
					expect(12345).toBeValid(model);
				});

				it("number above max length is invalid", function () {
					expect(123456).toBeInvalid(model);
				});
			});

			describe("length - min only trimmed", function () {

				beforeEach(function () {
					validator.attr("name").length({ min: 2, trim: true }, "Needs a name of at least 2 characters");
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid(model);
				});

				it("min length spaces only is invalid", function () {
					expect("  ").toBeInvalid(model);
				});

				it("min length tabs only is invalid", function () {
					expect("\t\t").toBeInvalid(model);
				});

				it("insufficient length when trimmed is invalid", function () {
					expect("  A  ").toBeInvalid(model);
				});

				it("min length string value is valid", function () {
					expect("ab").toBeValid(model);
				});

				it("min length number is valid", function () {
					expect(12).toBeValid(model);
				});
			});

			describe("length - min and max trimmed", function () {

				beforeEach(function () {
					validator.attr("name").length({ min: 2, max: 5, trim: true }, "Needs a name of at least 2 characters");
				});

				it("empty string is invalid", function () {
					expect("").toBeInvalid(model);
				});

				it("min length spaces only is invalid", function () {
					expect("  ").toBeInvalid(model);
				});

				it("min length tabs only is invalid", function () {
					expect("\t\t").toBeInvalid(model);
				});

				it("below min length when trimmed is invalid", function () {
					expect("  A  ").toBeInvalid(model);
					expect("     A").toBeInvalid(model);
					expect("A    ").toBeInvalid(model);
				});

				it("above max length when trimmed is invalid", function () {
					expect("  AAAAAA  ").toBeInvalid(model);
					expect("     AAAAAAA").toBeInvalid(model);
					expect("AAAAAAA    ").toBeInvalid(model);
				});

				it("within min and max when trimmed is valid", function () {
					expect("  AAAA   ").toBeValid(model);
				});

				it("within min and max is valid", function () {
					expect("ab").toBeValid(model);
					expect("abc").toBeValid(model);
					expect("abcd").toBeValid(model);
					expect("abcde").toBeValid(model);
				});

				it("number within min and max is valid", function () {
					expect(12).toBeValid(model);
					expect(123).toBeValid(model);
					expect(1234).toBeValid(model);
					expect(12345).toBeValid(model);
				});
			});

			describe("custom check", function () {

				beforeEach(function () {
					validator.attr("name").check(function (value, context) {
						return value.toString().indexOf("monkey") != -1;
					}, "Needs to contain the word monkey");
				});

				it("value not matching rule is invalid", function () {
					expect("asdf").toBeInvalid(model);
				});

				it("value matching rule is valid", function () {
					expect("monkey man").toBeValid(model);
				});
			});
		});





	});
});