# Contributing

First of all, thanks for considering contributing code or other resources.
Much appreciated!

## Submitting issues

Please try to keep your texts short, but still include enough detail for other
people to understand and **reproduce** your issue.
E.g. if a bug affects a particular version, mention the version number. It might
be also helpful to talk a bit about your environment, like operating system and
platform (x86, x86_64, arm).

For bugs or feature requests provide:

- Sensible, but short summary/title.
- Description of the actual behavior, preferably with detailed steps to
  reproduce the issue.
- Description of the expected behavior.
- If you know about older versions that worked correctly, mention that as well.

Be polite, even if your issue does not (initially) get a lot of attention,
or project maintainers close it as invalid/wontfix/etc.

If you already diagnosed an issue and found the root cause, and feel like
spending some extra time coding up a fix, then please don't hesitate to file a
pull request instead of an issue. Project maintainers will love you.

### Bad

> There is a bug in your software. When I click the button, it crashes.

### Better

> Crash in version 1.0 when clicking Print button
>
> Hey, I'm using your software in version 1.0 on a Windows 7 (64-bit) system
> along with FooBar Browser version 13.0. Unfortunately, it crashes when I
> click on the Print button. This didn't happen in version 0.9.
>
> 1. Open document xyz
> 2. Click Print button
> 3. The application becomes unresponsive and has to be killed manually.
>
> I expect the application to print the document and then to continue working
> normally.

## Submitting code and/or documentation

- Your code should look and feel like the other code in the project, e.g. it
  should try to mimic/abide by the existing code formatting style and API
  design decisions.
- If you plan to implement or revise a major feature/major API, or
  *break things* (for the better) in general, then please file an issue or
  pull request early. That way the project maintainers might suggest changes
  early and/or refine/reject ideas before you spend a lot time writing code that
  won't be merged in the current form.
- Please provide (unit) tests, where appropriate and feasible.
- Please use pull requests and avoid *plain* patches, etc.
- Your commits should include at the very least an exploratory in plain English.
  Feel free to make use additional long messages current version control systems
  support, in particular if your commit is anything more than a simple bugfix.
- Try to use gender-neutral language. Why? For four good reasons:
  - It is more inclusive and should work well-enough for all people.
  - It doesn't cost you anything, really, and no, it does not infringe upon your
    rights. It is easy enough to do, at least, in the English language.
  - Most importantly: because this file tells you to ;)

## Copyrights and License

Any new code you submit **must be licensed** under the same license as the
project license.
Exception to this rule are only third-party libraries, which have to be
licensed under a compatible license nonetheless and may **not** make the whole
project less permissive.
E.g. you may **not** submit code that uses plain GPL in a derivative way in a
project otherwise licensed under a more permissive license such as the
BSD/MIT/GPL licenses.

You retain your copyright, or may assign it to the project/project maintainer.
However, you must of course own the copyright or have the permission from the
owners before submitting code. Work-for-hire-laws can be complicated.

## Enforcement

The points outlined in this document are more guidelines than
rules-set-in-stone.

If in doubt, **the project maintainer(s) make the final decision**.
