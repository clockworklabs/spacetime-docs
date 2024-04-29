type Nav = {
  items: NavItem[];
};
type NavItem = NavPage | NavSection;
type NavPage = {
  type: "page";
  path: string;
  slug: string;
  title: string;
  disabled?: boolean;
  href?: string;
};
type NavSection = {
  type: "section";
  title: string;
};

function page(title: string, slug: string, path: string, props?: { disabled?: boolean; href?: string; description?: string }): NavPage {
  return { type: "page", path, slug, title, ...props };
}
function section(title: string): NavSection {
  return { type: "section", title };
}

const nav: Nav = {
  items: [
    section("Intro"),
    page("Overview",            "index",                  "index.md"), // TODO(BREAKING): For consistency & clarity, 'index' slug should be renamed 'intro'?
    page("Getting Started",     "getting-started",        "getting-started.md"),
    page("Overview",            "index",                  "index.md"), // TODO(BREAKING): For consistency & clarity, 'index' slug should be renamed 'intro'?
    page("Getting Started",     "getting-started",        "getting-started.md"),

    section("Deploying"),
    page("Overview",            "deploying",              "deploying/index.md"),
    page("Hosted",              "deploying/hosted",       "deploying/hosted.md"),
    page("Self-Hosted",         "deploying/hosted",       "deploying/self-hosted.md"),

    section("Unity Tutorial - Basic Multiplayer"),
    page("Overview",                "unity-tutorial",     "unity/index.md"),
    page("1 - Project Setup",       "unity/part-1",       "unity/part-1.md"),
    page("2 - Server (C# Module)",  "unity/part-2",       "unity/part-2a-rust.md"),
    page("3 - Client (Unity)",      "unity/part-2",       "unity/part-2.md"),

    section("Unity Tutorial - Advanced"),
    page("4 - Resources & Scheduling",   "unity/part-4",  "unity/part-4.md"),
    page("5 - BitCraft Mini",            "unity/part-5",  "unity/part-5.md"),

    section("Server Module Languages"),
    page("Overview",        "modules",                    "modules/index.md"),
    page("Rust Quickstart", "modules/rust/quickstart",    "modules/rust/quickstart.md"),
    page("Rust Reference",  "modules/rust",               "modules/rust/index.md"),
    page("C# Quickstart",   "modules/c-sharp/quickstart", "modules/c-sharp/quickstart.md"),
    page("C# Reference",    "modules/c-sharp",            "modules/c-sharp/index.md"),

    section("Client SDK Languages"),
    page("Overview",              "sdks",                         "sdks/index.md"),
    page("Typescript Quickstart", "sdks/typescript/quickstart",   "sdks/typescript/quickstart.md"),
    page("Typescript Reference",  "sdks/typescript",              "sdks/typescript/index.md"),
    page("Rust Quickstart",       "sdks/rust/quickstart",         "sdks/rust/quickstart.md"),
    page("Rust Reference",        "sdks/rust",                    "sdks/rust/index.md"),
    page("Python Quickstart",     "sdks/python/quickstart",       "sdks/python/quickstart.md"),
    page("Python Reference",      "sdks/python",                  "sdks/python/index.md"),
    page("C# Quickstart",         "sdks/c-sharp/quickstart",      "sdks/c-sharp/quickstart.md"),
    page("C# Reference",          "sdks/c-sharp",                 "sdks/c-sharp/index.md"),

    section("WebAssembly ABI"),
    page("Module ABI Reference",  "webassembly-abi",              "webassembly-abi/index.md"),

    section("HTTP API"),
    page("HTTP",        "http",           "http/index.md"),
    page("`/identity`", "http/identity",  "http/identity.md"),
    page("`/database`", "http/database",  "http/database.md"),
    page("`/energy`",   "http/energy",    "http/energy.md"),

    section("WebSocket API Reference"),
    page("WebSocket",   "ws",             "ws/index.md"),

    section("Data Format"),
    page("SATN",        "satn",           "satn.md"),
    page("BSATN",       "bsatn",          "bsatn.md"),

    section("SQL"),
    page("SQL Reference", "sql",    "sql/index.md"),
  ],
};

export default nav;
