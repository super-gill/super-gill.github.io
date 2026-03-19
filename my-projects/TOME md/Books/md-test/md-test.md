Document Title: Markdown Formatting Test
Document Version: v1.0.0
Document Date: 19/03/2026

# Inline Formatting

## Text Styles

### Bold

This is **bold text** and this is also __bold text__.

### Italic

This is *italic text* and this is also _italic text_.

### Bold and Italic

This is ***bold and italic*** and this is ___also bold and italic___.

### Strikethrough

This is ~~strikethrough text~~.

### Inline Code

Use the `console.log()` function to print output. You can also reference a `variable_name` or a `file.txt` path.

### Links

This is an [inline link](https://example.com) and this is an [inline link with a title](https://example.com "Example Site").

Auto-linked URL: https://example.com

### Mixed Inline Formatting

You can **combine *bold and italic*** in the same line, use `code` alongside **bold**, and even ~~strike through **bold text**~~.

---

# Block Elements

## Paragraphs and Line Breaks

This is the first paragraph. It contains multiple sentences to demonstrate how paragraph text wraps and flows within the TOME rendering engine. The text should reflow naturally based on the width of the content area.

This is the second paragraph, separated by a blank line. Paragraphs are the most basic block element in markdown.

## Headings

The H1 and H2 headings are used for TOME navigation (groups and pages). Below are the sub-headings used within a page.

### This is a Heading 3

Content under heading 3 receives indent level 1.

#### This is a Heading 4

Content under heading 4 receives indent level 2.

##### This is a Heading 5

Content under heading 5 receives indent level 3.

## Blockquotes

### Simple Blockquote

> This is a blockquote. It is commonly used for callouts, warnings, or to highlight important information in documentation.

### Multi-line Blockquote

> This is a multi-line blockquote.
>
> It can span multiple paragraphs. Each paragraph within the blockquote is separated by a blank line with a `>` prefix.
>
> This is the third paragraph in the blockquote.

### Nested Blockquote

> This is the outer blockquote.
>
> > This is a nested blockquote inside the outer one.
>
> Back to the outer blockquote.

### Blockquote with Other Elements

> **Important:** This blockquote contains **bold**, *italic*, and `inline code`.
>
> - It also contains a list item
> - And another list item
>
> > And a nested quote for good measure.

## Horizontal Rules

Three different horizontal rule syntaxes (all render identically):

---

***

___

---

# Lists

## Unordered Lists

### Simple Unordered List

- First item
- Second item
- Third item
- Fourth item

### Nested Unordered List

- Top-level item 1
  - Nested item 1a
  - Nested item 1b
    - Deeply nested item 1b-i
    - Deeply nested item 1b-ii
  - Nested item 1c
- Top-level item 2
  - Nested item 2a

### Unordered List with Paragraphs

- First item with a longer description that might wrap to multiple lines depending on the viewport width.

- Second item with a paragraph break above it.

- Third item.

## Ordered Lists

### Simple Ordered List

1. First item
2. Second item
3. Third item
4. Fourth item

### Nested Ordered List

1. First top-level item
   1. Nested item 1.1
   2. Nested item 1.2
      1. Deeply nested item 1.2.1
      2. Deeply nested item 1.2.2
   3. Nested item 1.3
2. Second top-level item
   1. Nested item 2.1

### Ordered List Starting at a Different Number

5. This list starts at five
6. Continues to six
7. And seven

## Mixed Lists

1. Ordered item one
   - Unordered sub-item
   - Another unordered sub-item
2. Ordered item two
   1. Ordered sub-item
   2. Another ordered sub-item
      - With an unordered sub-sub-item
3. Ordered item three

## Task Lists

- [x] Completed task
- [x] Another completed task
- [ ] Incomplete task
- [ ] Another incomplete task
  - [x] Completed sub-task
  - [ ] Incomplete sub-task

---

# Code

## Inline Code

Use `npm install` to install dependencies. The `--save-dev` flag marks them as development dependencies.

## Fenced Code Blocks

### JavaScript

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Print the first 10 Fibonacci numbers
for (let i = 0; i < 10; i++) {
  console.log(`F(${i}) = ${fibonacci(i)}`);
}
```

### Python

```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + middle + quicksort(right)

print(quicksort([3, 6, 8, 10, 1, 2, 1]))
```

### SQL

```sql
SELECT
    u.name,
    u.email,
    COUNT(o.id) AS order_count,
    SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= '2025-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 0
ORDER BY total_spent DESC
LIMIT 10;
```

### JSON

```json
{
  "name": "tome-markdown",
  "version": "2.0.0",
  "settings": {
    "theme": "dark",
    "sidebar": true,
    "exportFormats": ["pdf", "md"]
  },
  "books": [
    { "file": "manual.md", "title": "Operations Manual" },
    { "file": "qms.md", "title": "Quality Management System" }
  ]
}
```

### Plain Code Block (No Language)

```
This is a plain code block with no syntax highlighting.
It preserves whitespace    and    spacing.
  Indentation is maintained.
    Like this.
```

### HTML

```html
<div class="card">
  <h2>Hello World</h2>
  <p>This is a <strong>code block</strong> showing HTML.</p>
  <ul>
    <li>Item one</li>
    <li>Item two</li>
  </ul>
</div>
```

### CSS

```css
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
  padding: 18px;
}

.card:hover {
  border-color: rgba(125, 211, 252, 0.55);
}
```

### Bash / Shell

```bash
#!/bin/bash
echo "Deploying to production..."
git pull origin main
npm ci
npm run build
pm2 restart all
echo "Deployment complete."
```

---

# Tables

## Simple Table

| Name       | Role            | Department |
| ---------- | --------------- | ---------- |
| Alice      | Engineer        | Platform   |
| Bob        | Designer        | Product    |
| Charlie    | Project Manager | Operations |
| Diana      | Data Analyst    | Analytics  |

## Table with Alignment

| Left-Aligned | Centre-Aligned | Right-Aligned |
| :----------- | :------------: | ------------: |
| Row 1        | Data           |          1.00 |
| Row 2        | Data           |         22.50 |
| Row 3        | Data           |        333.99 |
| Row 4        | Data           |      4,444.00 |

## Table with Inline Formatting

| Feature          | Status       | Notes                                      |
| ---------------- | ------------ | ------------------------------------------ |
| **Authentication** | ✓ Complete | Uses `OAuth 2.0` with PKCE flow           |
| **Authorisation**  | ✓ Complete | Role-based with *four* permission levels   |
| **Audit Logging**  | ⚠ Partial  | Missing `DELETE` operation tracking        |
| ~~Legacy API~~     | ✗ Removed  | Deprecated in **v1.8**, removed in **v2.0** |

## Wide Table

| ID  | Created    | Title                          | Priority | Assignee    | Status      | Resolution | SLA Met | Category        |
| --- | ---------- | ------------------------------ | -------- | ----------- | ----------- | ---------- | ------- | --------------- |
| 001 | 2026-01-15 | Server unreachable             | P1       | Alice       | Resolved    | Rebooted   | Yes     | Infrastructure  |
| 002 | 2026-01-16 | Email not sending              | P2       | Bob         | Resolved    | Config fix | Yes     | Email           |
| 003 | 2026-01-17 | Slow dashboard load            | P3       | Charlie     | In Progress | -          | -       | Performance     |
| 004 | 2026-01-18 | New user setup                 | P4       | Diana       | Open        | -          | -       | User Management |
| 005 | 2026-01-19 | Print driver not found         | P2       | Alice       | Resolved    | Reinstall  | No      | Peripherals     |

---

# Images

## Inline Image

![Placeholder image](file.png)

## Image with Title

![Logo image](doLogo.png "Digital Origin Logo")

---

# HTML Passthrough

Since TOME uses markdown-it with `html: true`, raw HTML renders directly.

## Custom Div

<div style="padding: 12px; border: 2px dashed #7dd3fc; border-radius: 8px; margin: 12px 0;">
  <strong>Custom HTML block:</strong> This is rendered from raw HTML within the markdown source.
</div>

## Details / Summary (Collapsible)

<details>
<summary>Click to expand this section</summary>

This content is hidden by default and revealed when the user clicks the summary. It supports **markdown** inside (though rendering depends on the parser configuration).

- Item one
- Item two
- Item three

</details>

## Superscript and Subscript

H<sub>2</sub>O is water. E = mc<sup>2</sup> is Einstein's famous equation.

## Keyboard Input

Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> to open the command palette.

## Abbreviation with Title

<abbr title="Quality Management System">QMS</abbr> documentation should be reviewed quarterly.

---

# Typographer Features

markdown-it's typographer option converts certain character sequences automatically.

## Smart Quotes

"Double quotes" become smart quotes. 'Single quotes' become smart quotes too.

## Dashes

An em dash---like this---is created with three hyphens. An en dash -- like this -- uses two hyphens.

## Ellipsis

Three dots become an ellipsis...

## Plus/Minus

The temperature was +-5 degrees from the target.

---

# Special Cases

## Long Unbroken Text

Thisisaverylongstringwithnospacesorbreakstotesthowtherendererhandlesoverflowingcontentwithinthecontentareaofthepageandwhetheritwrapsorscrollshorizontally.

## Escaped Characters

These characters are escaped with backslashes: \* \_ \` \# \[ \] \( \) \{ \} \+ \- \. \!

## Emoji (Unicode)

Common symbols: ✓ ✗ ⚠ ★ ☆ → ← ↑ ↓ ↔ • ◦ ■ □ ▲ ▼ © ® ™

## Nested Formatting Stress Test

> **Note:** This blockquote contains a table, a list, and formatted text.
>
> | Test   | Result |
> | ------ | ------ |
> | **A**  | Pass   |
> | *B*    | Fail   |
>
> 1. First ordered item with `code`
> 2. Second item with **bold** and *italic*
>
> Final paragraph with a [link](https://example.com).

## Adjacent Code Blocks

```javascript
// Block 1
const a = 1;
```

```python
# Block 2
b = 2
```

```sql
-- Block 3
SELECT 3;
```

## Empty and Minimal Elements

> (empty blockquote body above)

---

| Single Cell |
| ----------- |
| One row     |

---

- Single item list

1. Single item ordered list

---

# Indent Level Tests

## Indent 1 — All Elements at H3

Every element below sits under an H3, so it receives `data-indent="1"` (padding-left: 20px). Check that all left edges, borders, and number gutters render correctly.

### Paragraph at Indent 1

This paragraph should be indented one level. It contains enough text to verify that wrapping still works correctly when the left margin is shifted inward by the indent system.

### Unordered List at Indent 1

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered List at Indent 1

1. First item
2. Second item
   1. Nested item
   2. Another nested item
3. Third item

### Table at Indent 1

| Name    | Role     | Status     |
| ------- | -------- | ---------- |
| Alice   | Engineer | Active     |
| Bob     | Designer | On leave   |
| Charlie | Manager  | Active     |

### Blockquote at Indent 1

> This blockquote sits at indent level 1. The left border of the blockquote should be visible and properly aligned with the indent.

### Code Block at Indent 1

```javascript
function indentTest() {
  return "This code block is at indent level 1";
}
```

### Image at Indent 1

![Test image at indent 1](file.png)

### Horizontal Rule at Indent 1

---

### Mixed Content at Indent 1

Here is a paragraph followed by a table, a list, and a code block — all at indent level 1.

| Check     | Expected         |
| --------- | ---------------- |
| Left edge | Aligned at 20px  |
| Borders   | Fully visible    |
| Width     | Reduced by 20px  |

1. First ordered item
2. Second ordered item
3. Third ordered item

- Unordered item A
- Unordered item B

```
Plain code block at indent 1
```

> Blockquote to finish the section.

## Indent 2 — All Elements at H4

Every element below sits under an H4, so it receives `data-indent="2"` (padding-left: 35px). The indent is deeper — check that nothing clips or overflows.

### Container for Indent 2

#### Paragraph at Indent 2

This paragraph should be indented two levels. The left margin is now 35px. Long text should still wrap correctly within the remaining content width.

#### Unordered List at Indent 2

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

#### Ordered List at Indent 2

1. First item
2. Second item
   1. Nested item
   2. Another nested item
3. Third item

#### Table at Indent 2

| Name    | Role     | Status     |
| ------- | -------- | ---------- |
| Alice   | Engineer | Active     |
| Bob     | Designer | On leave   |
| Charlie | Manager  | Active     |

#### Blockquote at Indent 2

> This blockquote sits at indent level 2. The left border should still be fully visible despite the deeper indent.

#### Code Block at Indent 2

```python
def indent_test():
    return "This code block is at indent level 2"
```

#### Image at Indent 2

![Test image at indent 2](file.png)

#### Horizontal Rule at Indent 2

---

#### Mixed Content at Indent 2

Paragraph, table, ordered list, unordered list, code block, and blockquote — all at indent level 2.

| Check     | Expected         |
| --------- | ---------------- |
| Left edge | Aligned at 35px  |
| Borders   | Fully visible    |
| Width     | Reduced by 35px  |

1. First ordered item
2. Second ordered item
3. Third ordered item

- Unordered item A
- Unordered item B

```
Plain code block at indent 2
```

> Blockquote to finish the section.

## Indent 3 — All Elements at H5

Every element below sits under an H5, so it receives `data-indent="3"` (padding-left: 50px). This is the deepest indent — check for clipping, overflow, and tight spaces.

### Container for Indent 3

#### Container for Indent 3 Inner

##### Paragraph at Indent 3

This paragraph should be indented three levels. The left margin is now 50px. This is the deepest indent TOME applies. Text should still wrap and remain readable.

##### Unordered List at Indent 3

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

##### Ordered List at Indent 3

1. First item
2. Second item
   1. Nested item
   2. Another nested item
3. Third item

##### Table at Indent 3

| Name    | Role     | Status     |
| ------- | -------- | ---------- |
| Alice   | Engineer | Active     |
| Bob     | Designer | On leave   |
| Charlie | Manager  | Active     |

##### Blockquote at Indent 3

> This blockquote sits at indent level 3. The left border should still be fully visible even at the deepest indent.

##### Code Block at Indent 3

```sql
-- This code block is at indent level 3
SELECT * FROM indent_test WHERE level = 3;
```

##### Image at Indent 3

![Test image at indent 3](file.png)

##### Horizontal Rule at Indent 3

---

##### Mixed Content at Indent 3

Paragraph, table, ordered list, unordered list, code block, and blockquote — all at indent level 3.

| Check     | Expected         |
| --------- | ---------------- |
| Left edge | Aligned at 50px  |
| Borders   | Fully visible    |
| Width     | Reduced by 50px  |

1. First ordered item
2. Second ordered item
3. Third ordered item

- Unordered item A
- Unordered item B

```
Plain code block at indent 3
```

> Blockquote to finish the section.

## Indent Transitions

This section tests moving between indent levels within a single page to verify that elements correctly pick up and release their indent as the heading hierarchy changes.

### Back to Indent 1

This paragraph is at indent 1 after the deeper sections above.

| Indent | Value |
| ------ | ----- |
| Level  | 1     |

1. Ordered at indent 1

#### Drop to Indent 2

This paragraph is at indent 2.

| Indent | Value |
| ------ | ----- |
| Level  | 2     |

1. Ordered at indent 2

##### Drop to Indent 3

This paragraph is at indent 3.

| Indent | Value |
| ------ | ----- |
| Level  | 3     |

1. Ordered at indent 3

### Reset to Indent 1

After the deep nesting above, this paragraph should be back at indent 1. The table and list below should also reset.

| Indent | Value |
| ------ | ----- |
| Level  | 1     |

1. Ordered at indent 1

## Wide Table at Each Indent

Tests whether wide tables handle reduced width gracefully at each indent level.

### Wide Table at Indent 1

| ID  | Created    | Title                  | Priority | Assignee | Status      | Resolution | SLA Met | Category       |
| --- | ---------- | ---------------------- | -------- | -------- | ----------- | ---------- | ------- | -------------- |
| 001 | 2026-01-15 | Server unreachable     | P1       | Alice    | Resolved    | Rebooted   | Yes     | Infrastructure |
| 002 | 2026-01-16 | Email not sending      | P2       | Bob      | Resolved    | Config fix | Yes     | Email          |

#### Wide Table at Indent 2

| ID  | Created    | Title                  | Priority | Assignee | Status      | Resolution | SLA Met | Category       |
| --- | ---------- | ---------------------- | -------- | -------- | ----------- | ---------- | ------- | -------------- |
| 001 | 2026-01-15 | Server unreachable     | P1       | Alice    | Resolved    | Rebooted   | Yes     | Infrastructure |
| 002 | 2026-01-16 | Email not sending      | P2       | Bob      | Resolved    | Config fix | Yes     | Email          |

##### Wide Table at Indent 3

| ID  | Created    | Title                  | Priority | Assignee | Status      | Resolution | SLA Met | Category       |
| --- | ---------- | ---------------------- | -------- | -------- | ----------- | ---------- | ------- | -------------- |
| 001 | 2026-01-15 | Server unreachable     | P1       | Alice    | Resolved    | Rebooted   | Yes     | Infrastructure |
| 002 | 2026-01-16 | Email not sending      | P2       | Bob      | Resolved    | Config fix | Yes     | Email          |
