!(function () {

    function asm_def() {
        return {
            // Set defaultToken to invalid to see what you do not tokenize yet
            defaultToken: 'invalid',

            // C# style strings
            escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

            registers: /%?\b(r[0-9]+[dbw]?|([er]?([abcd][xhl]|cs|fs|ds|ss|sp|bp|ip|sil?|dil?))|[xyz]mm[0-9]+|sp|fp|lr)\b/,

            intelOperators: /PTR|(D|Q|[XYZ]MM)?WORD/,

            tokenizer: {
                root: [
                    // Error document
                    [/^<.*>$/, { token: 'annotation' }],
                    // inline comments
                    [/\/\*/, 'comment', '@comment'],
                    // Label definition
                    [/^[.a-zA-Z0-9_$?@].*:/, { token: 'type.identifier' }],
                    // Label definition (quoted)
                    [/^"([^"\\]|\\.)*":/, { token: 'type.identifier' }],
                    // Label definition (ARM style)
                    [/^\s*[|][^|]*[|]/, { token: 'type.identifier' }],
                    // Label definition (CL style)
                    [/^\s*[.a-zA-Z0-9_$|]*\s+(PROC|ENDP|DB|DD)/, { token: 'type.identifier', next: '@rest' }],
                    // Constant definition
                    [/^[.a-zA-Z0-9_$?@][^=]*=/, { token: 'type.identifier' }],
                    // opcode
                    [/[.a-zA-Z_][.a-zA-Z_0-9]*/, { token: 'keyword', next: '@rest' }],
                    // braces and parentheses at the start of the line (e.g. nvcc output)
                    [/[(){}]/, { token: 'operator', next: '@rest' }],
                    // msvc can have strings at the start of a line in a inSegDirList
                    [/`/, { token: 'string.backtick', bracket: '@open', next: '@segDirMsvcstring' }],

                    // whitespace
                    { include: '@whitespace' },
                ],

                rest: [
                    // pop at the beginning of the next line and rematch
                    [/^.*$/, { token: '@rematch', next: '@pop' }],

                    [/@registers/, 'variable.predefined'],
                    [/@intelOperators/, 'annotation'],
                    // inline comments
                    [/\/\*/, 'comment', '@comment'],

                    // brackets
                    [/[{}<>()[\]]/, '@brackets'],

                    // ARM-style label reference
                    [/[|][^|]*[|]*/, 'type.identifier'],

                    // numbers
                    [/-?\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
                    [/([$]|0[xX])[0-9a-fA-F]+/, 'number.hex'],
                    [/-?0[xX][0-9a-fA-F]+/, 'number.hex'],
                    [/-?0[bB][01]+/, 'number.binary'],
                    [/-?0[dD][0-9]+/, 'number.decimal'],
                    [/-?0[0-7]+/, 'number.octal'],
                    [/-?[0-9a-fA-F]+[Hh]/, 'number.hex'],
                    [/-?[0-7]+[OoQq]/, 'number.octal'],
                    [/-?[01]+[Bb]/, 'number.binary'],
                    [/-?\d+[Dd]/, 'number.decimal'],
                    [/-?\d+/, 'number'],
                    // ARM-style immediate numbers (which otherwise look like comments)
                    [/#-?\d+/, 'number'],

                    // operators
                    [/[-+,*/!:&{}()]/, 'operator'],

                    // strings
                    [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated string
                    [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                    // `msvc does this, sometimes'
                    [/`/, { token: 'string.backtick', bracket: '@open', next: '@msvcstring' }],
                    [/'/, { token: 'string.singlequote', bracket: '@open', next: '@sstring' }],

                    // characters
                    [/'[^\\']'/, 'string'],
                    [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
                    [/'/, 'string.invalid'],

                    // Assume anything else is a label reference. .NET uses ` in some identifiers
                    [/%?[.?_$a-zA-Z@][.?_$a-zA-Z0-9@`]*/, 'type.identifier'],

                    // whitespace
                    { include: '@whitespace' },
                ],

                comment: [
                    [/[^/*]+/, 'comment'],
                    [/\/\*/, 'comment', '@push'], // nested comment
                    ['\\*/', 'comment', '@pop'],
                    [/[/*]/, 'comment'],
                ],

                string: [
                    [/[^\\"]+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
                ],

                msvcstringCommon: [
                    [/[^\\']+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/''/, 'string.escape'], // ` isn't escaped but ' is escaped as ''
                    [/\\./, 'string.escape.invalid'],
                ],

                msvcstring: [
                    { include: '@msvcstringCommon' },
                    [/'/, { token: 'string.backtick', bracket: '@close', next: '@pop' }],
                ],

                segDirMsvcstring: [
                    { include: '@msvcstringCommon' },
                    [/'/, { token: 'string.backtick', bracket: '@close', switchTo: '@rest' }],
                ],

                sstring: [
                    [/[^\\']+/, 'string'],
                    [/@escapes/, 'string.escape'],
                    [/\\./, 'string.escape.invalid'],
                    [/'/, { token: 'string.singlequote', bracket: '@close', next: '@pop' }],
                ],

                whitespace: [
                    [/[ \t\r\n]+/, 'white'],
                    [/\/\*/, 'comment', '@comment'],
                    [/\/\/.*$/, 'comment'],
                    [/[#;\\@].*$/, 'comment'],
                ],
            },
        };
    }

    // declaration
    const ClearBtnEl = document.getElementById("btn-clear");
    const AsmInputEl = document.getElementById("asm-input");
    const BinOutputEl = document.getElementById("bin-output");
    const HexOutputEl = document.getElementById("hex-output");
    const Asm2BinBtnEl = document.getElementById("btn-asm2bin");
    const Asm2HexBtnEl = document.getElementById("btn-asm2hex");
    const ConsoleBinEl = document.getElementById("console-bin");
    const ConsoleHexEl = document.getElementById("console-hex");
    const AsmInputAdjustEl = document.getElementById("asm-input-adjust");
    const OptStartPCEl = document.querySelector("input[name='opt-start-pc']")
    const OptStrictModeEl = document.querySelector("select[name='opt-strict-mode']")

    const BIN_OUTPUT_INIT = "<span class='no-select'>[Binary Console]</span>";
    const HEX_OUTPUT_INIT = "<span class='no-select'>[Hex Console]</span>";

    // storage
    class Storage {
        constructor(identifier) {
            this.identifier = identifier;
            try {
                this.data = JSON.parse(localStorage.getItem(identifier) || "{}");
            } catch (e) {
                this.data = {};
            }
        }
        get(key) {
            if (Object.prototype.hasOwnProperty.call(this.data, key))
                return this.data[key];
            else return undefined;
        }
        set(key, value) {
            Object.defineProperty(this.data, key, {
                value: value,
                enumerable: true,
                writable: true
            });
            localStorage.setItem(this.identifier, JSON.stringify(this.data));
        }
        destroy() {
            this.data = {};
            localStorage.removeItem(this.identifier);
        }
    }
    const st_opt = new Storage("asm-transformer-options");
    const st_content = new Storage("asm-input-content");
    const st_output = new Storage("asm-output-info");

    // init monaco editor
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.20.0/min/vs' } });
    let editor = null;
    require(['vs/editor/editor.main'], function () {
        try {
            monaco.languages.register({ id: 'assembly', extensions: ['.asm'], aliases: ['Assembly'] });
            monaco.languages.setMonarchTokensProvider('assembly', asm_def());

            // define color
            monaco.editor.defineTheme('theme-light', {
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'number', foreground: '#9d6f59' },
                ]
            });

            monaco.editor.defineTheme('theme-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'number', foreground: '#d29e6e' },
                ]
            });
            editor = monaco.editor.create(document.getElementById('monaco-container'), {
                value:
                    // load content from storage
                    st_content.get("content") || [
                        '; Assembly code example',
                        '',
                        '_start:',
                        '  addiu $1, $zero, 0x1234',
                        '  addiu $s0, $zero, 33',
                        '  beq   $s0, $1, -3',
                        '  sll   $zero, $zero, 0',
                        '  j     _start+2',
                        ''
                    ].join('\n'),
                theme: 'theme-light',
                mouseWheelZoom: true,
                automaticLayout: true,
                language: 'assembly'
            });

            // auto enclosing
            const char_pair = [
                ['(', ')'],
                ['{', '}'],
                ['<', '>'],
                ['[', ']'],
                ['"', '"'],
                ["'", "'"],
                ['`', '`']
            ]
            let selection = null;
            let selectedText = '';
            // listen selection change
            editor.onKeyDown(function (e) {
                selection = editor.getSelection();
                selectedText = editor.getModel().getValueInRange(selection);
            });
            editor.onDidType(function (e) {
                char_pair.forEach(([left, right]) => {
                    if (e === left) {
                        const pos = editor.getPosition();


                        let hasSelected = selection && !(selection.startLineNumber === selection.endLineNumber && selection.startColumn === selection.endColumn);
                        let isSelectionReverse = selection && (selection.startLineNumber === selection.positionLineNumber && selection.startColumn === selection.positionColumn);

                        const next_char = editor.getModel().getValueInRange({
                            startLineNumber: pos.lineNumber,
                            startColumn: pos.column,
                            endLineNumber: pos.lineNumber,
                            endColumn: pos.column + 1
                        });
                        console.log(hasSelected)
                        if (!hasSelected && next_char === left) return

                        editor.executeEdits("", [
                            {
                                range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                                text: selectedText + right,
                            }
                        ]);

                        if (hasSelected) { // set selection
                            editor.setSelection(new monaco.Selection(...((t) => isSelectionReverse ? t.reverse().flat() : t.flat())([
                                [pos.lineNumber, pos.column],
                                [pos.lineNumber + selection.endLineNumber - selection.startLineNumber,
                                pos.column + selection.endColumn - selection.startColumn - ((selection.endLineNumber - selection.startLineNumber) ? 1 : 0)]])
                            ));
                        } else { // set cursor position
                            editor.setPosition({
                                lineNumber: pos.lineNumber,
                                column: pos.column
                            });
                        }
                    }
                })
            });

            // listen content change
            editor.onDidChangeModelContent(() => {
                st_content.set("content", editor.getValue());
            });
        } catch (e) {
            AsmInputAdjustEl.value = e.stack.replace(/(\s+at(.*\(|\s+))([^\s]*)(:\d+:\d+)(.*?)/g, function (match, prefix, _, url, pos, subfix) {
                let parts = url.split('/');
                let fn = parts.pop();

                return `${prefix}${fn}${pos}${subfix}`;
            });
            AsmInputAdjustEl.style.color = "red";
            throw e;
        } finally {
            // remove loading layer
            document.getElementById("loading-full").animate([
                { opacity: 1 },
                { opacity: 0 }
            ], {
                duration: 500,
                fill: "forwards"
            });
            setTimeout(() => {
                document.getElementById("loading-full").remove();
            }, 500);
        }
    });

    const ResizeObserver = window.ResizeObserver;

    // binding asm-input height with textarea of asm-input-adjust
    const ro_adj = new ResizeObserver(entries => {
        let el = entries[0].target;
        document.documentElement.style.setProperty("--asm-input-height", el.style.height);
        if (editor) editor.layout();
    });
    ro_adj.observe(AsmInputAdjustEl);

    // output textarea resize binding
    const ro = new ResizeObserver(entries => {
        for (let entry of entries) {
            let el = entry.target;
            if (!el.style.height) return;
            if (el.id === "bin-output") {
                HexOutputEl.style.height = "";
            } else if (el.id === "hex-output") {
                BinOutputEl.style.height = "";
            }
        }
    });
    ro.observe(BinOutputEl);
    ro.observe(HexOutputEl);

    // store event
    // load options from storage
    OptStartPCEl.value = st_opt.get("startPC") || "0x00000000";
    OptStrictModeEl.value = st_opt.get("strict") || "OFF";
    // listen options change
    OptStartPCEl.addEventListener("change", () => {
        if (/0x[0-9a-fA-F]+/.test(OptStartPCEl.value)) st_opt.set("startPC", OptStartPCEl.value);
    });
    OptStrictModeEl.addEventListener("change", () => {
        st_opt.set("strict", OptStrictModeEl.value);
    });
    // load output from storage
    BinOutputEl.value = (st_output.get("output:arr:text:bin") || []).join("\n");
    HexOutputEl.value = (st_output.get("output:arr:text:hex") || []).join("\n");
    // load console from storage
    ConsoleBinEl.innerHTML = [BIN_OUTPUT_INIT, ...(st_output.get("console:arr:html:bin") || [])].join("\n");
    ConsoleHexEl.innerHTML = [HEX_OUTPUT_INIT, ...(st_output.get("console:arr:html:hex") || [])].join("\n");


    // click event binding
    ClearBtnEl.addEventListener("click", () => {
        st_output.destroy();
        BinOutputEl.value = "";
        HexOutputEl.value = "";
        ConsoleBinEl.innerHTML = BIN_OUTPUT_INIT;
        ConsoleHexEl.innerHTML = HEX_OUTPUT_INIT;
    })
    function opt() {
        let startPC = OptStartPCEl.value
        if (/0x[ 0-9a-fA-F]+/.test(startPC)) startPC = parseInt(startPC.replace(/ /g, ''))
        else startPC = 0
        let strict = OptStrictModeEl.value === "ON"
        return {
            startPC: Number.isNaN(startPC) ? 0 : startPC,
            comment: false,
            warn: !strict
        }
    }
    Asm2BinBtnEl.addEventListener("click", () => {
        try {
            BinOutputEl.value = "";
            ConsoleBinEl.innerHTML = BIN_OUTPUT_INIT;

            const tf = new ASMTransformer();
            tf.receive((type, value, span) => {
                ConsoleBinEl.appendChild(span);
            })

            const asm_content = editor.getValue();
            const asm_lines = asm_content.split(/\r?\n/)
            const bin_lines = tf.asm2bin(asm_lines, opt())

            BinOutputEl.value = bin_lines.join("\n")
            st_output.set("output:arr:text:bin", bin_lines)
            st_output.set("console:arr:html:bin", tf.getOutputSpan().map(span => span.outerHTML))
        } catch (e) {
            if (e.message !== "exit") throw e;
        }
    });
    Asm2HexBtnEl.addEventListener("click", () => {
        try {
            HexOutputEl.value = "";
            ConsoleHexEl.innerHTML = HEX_OUTPUT_INIT;

            const tf = new ASMTransformer();
            tf.receive((type, value, span) => {
                ConsoleHexEl.appendChild(span);
            })

            const asm_content = editor.getValue();
            const asm_lines = asm_content.split(/\r?\n/)
            const bin_lines = tf.asm2bin(asm_lines, opt())
            const hex_lines = tf.bin2hex(bin_lines)

            HexOutputEl.value = hex_lines.join("\n")
            st_output.set("output:arr:text:hex", hex_lines)
            st_output.set("console:arr:html:hex", tf.getOutputSpan().map(span => span.outerHTML))
        } catch (e) {
            if (e.message !== "exit") throw e;
        }
    });
})();