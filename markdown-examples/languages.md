Here are examples of changing a value in different scripting languages:

JavaScript:
```javascript
let originalValue = "Hello";
let modifiedValue = originalValue.toUpperCase();
console.log(modifiedValue); // Outputs: "HELLO"
```

Perl:
```perl
my $originalValue = "world";
my $modifiedValue = uc($originalValue);
print $modifiedValue; // Outputs: "WORLD"
```

Bash:
```bash
originalValue="example"
modifiedValue=$(echo "$originalValue" | tr '[:lower:]' '[:upper:]')
echo "$modifiedValue" # Outputs: "EXAMPLE"
```

Each example demonstrates a different way of transforming a string value to uppercase using language-specific methods.

This is the html in our html version:

<p>Here are examples of changing a value in different scripting languages:</p>

<p>JavaScript:</p><pre class="code-block-container" data-original-code="let originalValue = &quot;Hello&quot;;
let modifiedValue = originalValue.toUpperCase();
console.log(modifiedValue); // Outputs: &quot;HELLO&quot;" id="pre-block-0-1742324542168"><code class="language-javascript" tabindex="0" aria-label="Code example in javascript" id="code-block-0-1742324542168"><span class="token keyword">let</span> originalValue <span class="token operator">=</span> <span class="token string">"Hello"</span><span class="token punctuation">;</span>
<span class="token keyword">let</span> modifiedValue <span class="token operator">=</span> originalValue<span class="token punctuation">.</span><span class="token method function property-access">toUpperCase</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token console class-name">console</span><span class="token punctuation">.</span><span class="token method function property-access">log</span><span class="token punctuation">(</span>modifiedValue<span class="token punctuation">)</span><span class="token punctuation">;</span> <span class="token comment">// Outputs: "HELLO"</span></code><button class="code-copy-button" aria-label="Copy code to clipboard" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg> Copy</button><button class="code-copy-button" aria-label="Copy code to clipboard" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg> Copy</button></pre><p>Perl:</p><pre class="code-block-container" data-original-code="my $originalValue = &quot;world&quot;;
my $modifiedValue = uc($originalValue);
print $modifiedValue; // Outputs: &quot;WORLD&quot;" id="pre-block-1-1742324542169"><code class="language-perl" tabindex="0" aria-label="Code example in perl" id="code-block-1-1742324542169"><span class="token keyword">my</span> <span class="token variable">$originalValue</span> <span class="token operator">=</span> <span class="token string">"world"</span><span class="token punctuation">;</span>
<span class="token keyword">my</span> <span class="token variable">$modifiedValue</span> <span class="token operator">=</span> uc<span class="token punctuation">(</span><span class="token variable">$originalValue</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">print</span> <span class="token variable">$modifiedValue</span><span class="token punctuation">;</span> <span class="token operator">//</span> Outputs<span class="token punctuation">:</span> <span class="token string">"WORLD"</span></code><button class="code-copy-button" aria-label="Copy code to clipboard" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg> Copy</button><button class="code-copy-button" aria-label="Copy code to clipboard" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg> Copy</button></pre><p>Bash:</p><pre class="code-block-container" data-original-code="originalValue=&quot;example&quot;
modifiedValue=$(echo &quot;$originalValue&quot; | tr '[:lower:]' '[:upper:]')
echo &quot;$modifiedValue&quot; # Outputs: &quot;EXAMPLE&quot;" id="pre-block-2-1742324542179"><code class="language-bash" tabindex="0" aria-label="Code example in bash" id="code-block-2-1742324542179"><span class="token assign-left variable">originalValue</span><span class="token operator">=</span><span class="token string">"example"</span>
<span class="token assign-left variable">modifiedValue</span><span class="token operator">=</span><span class="token variable"><span class="token variable">$(</span><span class="token builtin class-name">echo</span> <span class="token string">"<span class="token variable">$originalValue</span>"</span> <span class="token operator">|</span> <span class="token function">tr</span> <span class="token string">'[:lower:]'</span> <span class="token string">'[:upper:]'</span><span class="token variable">)</span></span>
<span class="token builtin class-name">echo</span> <span class="token string">"<span class="token variable">$modifiedValue</span>"</span> <span class="token comment"># Outputs: "EXAMPLE"</span></code><button class="code-copy-button" aria-label="Copy code to clipboard" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg> Copy</button><button class="code-copy-button" aria-label="Copy code to clipboard" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg> Copy</button></pre><p>Each example demonstrates a different way of transforming a string value to uppercase using language-specific methods.</p>