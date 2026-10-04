"""Word data for ste-lint.py (ASD-STE100 profile for rheophile.ca).

The ASD-STE100 dictionary is copyright ASD and is not in this repo. This
list holds the unapproved words and phrases this site used, each with the
approved alternative. Add a word here when a review finds a new one.
"""

# unapproved word (lower case) -> approved alternative
UNAPPROVED = {
    "allow": "let", "allows": "lets", "allowed": "let / permitted", "allowing": "let",
    "enable": "let / make possible", "enables": "lets / makes possible",
    "enabled": "let / made possible", "enabling": "let",
    "need": "must / be necessary", "needs": "must / is necessary",
    "needed": "necessary", "needing": "must",
    "require": "be necessary", "requires": "is necessary",
    "required": "necessary", "requiring": "necessary",
    "should": "must", "shall": "must",
    "may": "can", "might": "can / possibly", "could": "can",
    "ensure": "make sure", "ensures": "makes sure", "ensured": "made sure",
    "via": "through / with",
    "since": "because / after",
    "once": "when / after / one time",
    "whether": "if",
    "which": "that",
    "however": "but",
    "within": "in",
    "upon": "on",
    "over": "more than / on / above",
    "roughly": "approximately",
    "big": "large", "bigger": "larger", "huge": "very large",
    "provide": "give / supply", "provides": "gives / supplies",
    "provided": "gave / supplied", "providing": "give / supply",
    "perform": "do", "performs": "does", "performed": "did",
    "utilize": "use", "utilizes": "uses", "utilise": "use", "leverage": "use",
    "obtain": "get", "obtains": "gets", "obtained": "got",
    "happen": "occur", "happens": "occurs", "happened": "occurred",
    "just": "(delete) / only",
    "simply": "(delete)", "really": "(delete)", "actually": "(delete)",
    "basically": "(delete)", "totally": "(delete) / fully", "entirely": "fully",
    "whatever": "(name the items)",
    "etc": "(name the items)",
    "thrice": "three times",
    "hence": "thus",
    "plus": "and",
    "vs": "compared with", "versus": "compared with",
    "numerous": "many",
    "commence": "start", "terminate": "stop",
    "whilst": "while", "amongst": "among",
    "thereby": "thus", "whereby": "(split the sentence)",
    "gotcha": "problem", "tricky": "difficult",
}

# unapproved phrase (lower case) -> approved alternative
UNAPPROVED_PHRASES = {
    "have to": "must", "has to": "must",
    "need to": "must", "needs to": "must",
    "in order to": "to",
    "due to": "because of",
    "prior to": "before",
    "as well as": "and",
    "a number of": "some",
    "and so on": "(name the items)",
    "e.g.": "for example",
    "i.e.": "that is",
    "out of band": "by a different channel (say which)",
    "under the hood": "(literal words: how it operates)",
    "on the fly": "(literal words)",
    "no longer": "not ... now",
}

# words that end in -ing and are not verbs (or are technical names)
ING_OK = {
    "thing", "nothing", "something", "anything", "everything", "string",
    "during", "ring", "king", "bring", "spring", "morning", "evening",
    "banking", "netting", "staging", "setting", "settings", "ceiling",
    "building", "meeting", "training", "planning", "missing", "following",
    "interesting", "encoding", "ordering", "branding", "padding", "warning",
    "heading", "listing", "mapping", "binding", "pending", "upcoming",
    "outgoing", "incoming", "standing", "existing", "remaining", "matching",
    "working", "willing", "staffing",
}

# irregular past participles (for the perfect-tense and passive patterns)
IRREGULAR_PP = {
    "been", "done", "gone", "made", "seen", "taken", "given", "written",
    "built", "kept", "run", "become", "known", "shown", "sent", "held",
    "told", "found", "left", "put", "set", "read", "got", "gotten", "lost",
    "paid", "sold", "split", "hidden", "chosen", "broken", "drawn", "grown",
}

ABBREVIATIONS = {"vs.", "e.g.", "i.e.", "no.", "st.", "dr.", "approx.", "corp.", "inc.", "ltd."}
