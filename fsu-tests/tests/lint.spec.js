// ESLint over each built page's script (fsu-tests/lint.js): no-undef, no-unused-vars and
// no-use-before-define. It is part of the suite so a run from fsu-tests covers it; CI also runs
// it on its own as `npm run lint`.
const {test,expect}=require("@playwright/test");
const {lint}=require("../lint.js");

test("both pages lint clean: no undefined names, nothing unused, nothing used before it exists",()=>{
  expect(lint()).toEqual([]);
});
