import type { Language } from "./types";

export const SAMPLES: Record<Language, { buggy: string; clean: string }> = {
  python: {
    buggy: `import os

API_KEY = "sk-live-9f8a7b6c5d4e3f2a1b0c"

def calculate_total(prices)
    total = 0
    for p in prices:
        total += p
    return total
    print("done")

user_input = input("Enter a formula: ")
result = eval(user_input)
if result = 10:
    print "Perfect ten!"
pritn("Total:", calculate_total([1, 2, 3])
`,
    clean: `import os


def greet(name):
    """Return a friendly greeting."""
    if not name:
        return "Hello, stranger!"
    return f"Hello, {name}!"


API_KEY = os.environ.get("API_KEY")
users = ["Ada", "Linus", "Grace"]
for user in users:
    print(greet(user))
`,
  },
  javascript: {
    buggy: `const API_KEY = "AIzaSyD-fake-key-1234567890abcdef";
var count = 0

function renderUser(user) {
  const box = document.getElementById("profile");
  box.innerHTML = "<h2>" + user.name + "</h2>";
  if (count = 0) {
    console.log("first render");
  }
  count++
  return eval(user.settings);
}

fucntion greet(name) {
  console.log("Hi " + name;
}
`,
    clean: `const API_KEY = process.env.API_KEY;

function greet(name) {
  const message = \`Hello, \${name}!\`;
  return message;
}

const users = ["Ada", "Linus", "Grace"];
users.forEach((user) => {
  console.log(greet(user));
});

export { greet, API_KEY };
`,
  },
  html: {
    buggy: `<html>
<head>
  <title>My Portfolio</title>
</head>
<body>
  <dvi class="card">
    <h1>Welcome!</h1>
    <img src="me.png">
    <a href="https://github.com" target="_blank">GitHub</a>
    <p>I build cool stuff
  </div>
  <script>
    const params = new URLSearchParams(location.search);
    document.getElementById("out").innerHTML = params.get("q");
  </script>
</body>
</html>
`,
    clean: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>My Portfolio</title>
</head>
<body>
  <main class="card">
    <h1>Welcome!</h1>
    <img src="me.png" alt="Portrait of me">
    <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
    <p>I build cool stuff.</p>
  </main>
  <script>
    const params = new URLSearchParams(location.search);
    document.getElementById("out").textContent = params.get("q");
  </script>
</body>
</html>
`,
  },
  css: {
    buggy: `.card {
  colr: #ff00aa;
  background-color: #12345;
  padding: 20
  width 300px;
  border-radius: 12px;
}

.title
  font-size: 2rem;
  font-weight: 800;
}

.danger {
  background: url("javascript:alert(1)");
}
`,
    clean: `:root {
  --brand: #ffcc00;
}

.card {
  color: var(--brand);
  background-color: #09090b;
  padding: 20px;
  border-radius: 12px;
  transition: transform 0.2s ease;
}

.card:hover {
  transform: translateY(-4px);
}

@media (max-width: 600px) {
  .card {
    padding: 12px;
  }
}
`,
  },
  cpp: {
    buggy: `#include <iostream>
#include <cstring>

class Account {
public:
    int balance
}

void main() {
    char name[10];
    int scores[5] = {90, 85, 77, 64, 99};
    gets(name);
    strcpy(name, "a-very-long-user-name");
    for (int i = 0; i <= 5; i++) {
        cout << scores[i] << endl;
    }
    int* data = new int[100];
    delete data;
    if (scores[0] = 100) {
        cout << "Perfect!" << endl
    }
}
`,
    clean: `#include <iostream>
#include <string>
#include <vector>

struct Student {
    std::string name;
    int score;
};

int main() {
    std::vector<Student> students = {{"Ada", 95}, {"Linus", 88}};
    for (const auto& s : students) {
        std::cout << s.name << ": " << s.score << std::endl;
    }
    return 0;
}
`,
  },
};
