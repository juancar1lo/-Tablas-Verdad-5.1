// Variables globales para el zoom y el árbol actual
let currentSvg = null;
let currentZoomBehavior = null;
let currentD3TreeData = null;

// Función para crear una asignación por defecto: asigna "true" a cada variable
function defaultAssignment(ast) {
    let assignment = {};

    function traverse(node) {
        if (node.type === "VAR") {
            assignment[node.name] = true;
        } else {
            if (node.operand) traverse(node.operand);
            if (node.left) traverse(node.left);
            if (node.right) traverse(node.right);
        }
    }
    traverse(ast);
    return assignment;
}

// Función para recorrer el AST y adjuntar en cada nodo el valor evaluado
function attachValues(node, assignment) {
    if (node.type === "VAR") {
        node.valor = assignment[node.name];
        return node;
    }
    if (node.type === "NOT") {
        node.operand = attachValues(node.operand, assignment);
        node.valor = !node.operand.valor;
        return node;
    }
    if (node.type === "AND") {
        node.left = attachValues(node.left, assignment);
        node.right = attachValues(node.right, assignment);
        node.valor = node.left.valor && node.right.valor;
        return node;
    }
    if (node.type === "OR") {
        node.left = attachValues(node.left, assignment);
        node.right = attachValues(node.right, assignment);
        node.valor = node.left.valor || node.right.valor;
        return node;
    }
    if (node.type === "IMP") {
        node.left = attachValues(node.left, assignment);
        node.right = attachValues(node.right, assignment);
        node.valor = (!node.left.valor) || node.right.valor;
        return node;
    }
    if (node.type === "BICOND") {
        node.left = attachValues(node.left, assignment);
        node.right = attachValues(node.right, assignment);
        node.valor = node.left.valor === node.right.valor;
        return node;
    }
    return node;
}

// Función para adjuntar valores al AST usando una asignación por defecto
function attachValuesToAST(ast) {
    const assignment = defaultAssignment(ast);
    return attachValues(ast, assignment);
}

document.addEventListener('DOMContentLoaded', function() {
    const inputExpresion = document.getElementById('expresion');

    // Función para agregar caracteres al campo de expresión
    function appendToExpression(value) {
        inputExpresion.value += value;
    }
    // Eventos para insertar símbolos
    document.getElementById('btnP').addEventListener('click', () => appendToExpression('p'));
    document.getElementById('btnQ').addEventListener('click', () => appendToExpression('q'));
    document.getElementById('btnR').addEventListener('click', () => appendToExpression('r'));
    document.getElementById('btnS').addEventListener('click', () => appendToExpression('s'));
    document.getElementById('btnT').addEventListener('click', () => appendToExpression('t'));
    document.getElementById('btnAnd').addEventListener('click', () => appendToExpression('∧'));
    document.getElementById('btnOr').addEventListener('click', () => appendToExpression('∨'));
    document.getElementById('btnNot').addEventListener('click', () => appendToExpression('¬'));
    document.getElementById('btnConditional').addEventListener('click', () => appendToExpression('→'));
    document.getElementById('btnBiconditional').addEventListener('click', () => appendToExpression('↔'));
    document.getElementById('btnOpenParen').addEventListener('click', () => appendToExpression('('));
    document.getElementById('btnCloseParen').addEventListener('click', () => appendToExpression(')'));

    // Botón para limpiar
    document.getElementById('btnLimpiar').addEventListener('click', function() {
        inputExpresion.value = "";
        document.getElementById('resultadoTabla').innerHTML = "";
        document.getElementById('parseTree').innerHTML = "";
    });

    // ------------------------------
    // Funciones para la Tabla de Verdad
    // ------------------------------
    function splitExpression(expr) {
        expr = expr.replace(/\s+/g, '');
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            const ch = expr[i];
            if (/[pqrst]/.test(ch)) {
                tokens.push(ch);
                i++;
                continue;
            }
            if (ch === '¬' || ch === '∧' || ch === '∨' || ch === '(' || ch === ')') {
                tokens.push(ch);
                i++;
                continue;
            }
            if (ch === '→' || ch === '↔') {
                tokens.push(ch);
                i++;
                continue;
            }
            i++;
        }
        return tokens;
    }

    function precedence(op) {
        switch (op) {
            case '¬':
                return 5;
            case '∧':
                return 4;
            case '∨':
                return 3;
            case '→':
                return 2;
            case '↔':
                return 1;
            default:
                return 0;
        }
    }

    function isLeftAssociative(op) { return (op === '∧' || op === '∨' || op === '↔'); }

    function isUnary(op) { return (op === '¬'); }

    function isBinary(op) { return (op === '∧' || op === '∨' || op === '→' || op === '↔'); }

    function applyOperator(op, left, right) {
        switch (op) {
            case '¬':
                return !left;
            case '∧':
                return left && right;
            case '∨':
                return left || right;
            case '→':
                return (!left) || right;
            case '↔':
                return left === right;
            default:
                return false;
        }
    }

    function evaluateRowInfix(tokens, values) {
        const opStack = [],
            valStack = [],
            resultByIndex = [];

        function popAndApply() {
            const opObj = opStack.pop();
            const op = opObj.op;
            if (isUnary(op)) {
                const val = valStack.pop();
                const res = applyOperator(op, val, null);
                valStack.push(res);
                resultByIndex[opObj.tokenIndex] = res ? 1 : 0;
            } else {
                const right = valStack.pop(),
                    left = valStack.pop();
                const res = applyOperator(op, left, right);
                valStack.push(res);
                resultByIndex[opObj.tokenIndex] = res ? 1 : 0;
            }
        }
        for (let i = 0; i < tokens.length; i++) {
            let tk = tokens[i];
            if (/[pqrst]/.test(tk)) {
                let boolVal = !!values[tk];
                valStack.push(boolVal);
                resultByIndex[i] = boolVal ? 1 : 0;
            } else if (tk === '(') {
                opStack.push({ op: tk, tokenIndex: i });
                resultByIndex[i] = '';
            } else if (tk === ')') {
                while (opStack.length > 0 && opStack[opStack.length - 1].op !== '(') { popAndApply(); }
                if (opStack.length > 0 && opStack[opStack.length - 1].op === '(') { opStack.pop(); }
                resultByIndex[i] = '';
            } else if (isUnary(tk)) {
                opStack.push({ op: tk, tokenIndex: i });
                resultByIndex[i] = '';
            } else if (isBinary(tk)) {
                const currentOpPrec = precedence(tk);
                while (opStack.length > 0 && opStack[opStack.length - 1].op !== '(') {
                    const topOp = opStack[opStack.length - 1],
                        topPrec = precedence(topOp.op);
                    if ((topPrec > currentOpPrec) || (topPrec === currentOpPrec && isLeftAssociative(topOp.op))) { popAndApply(); } else { break; }
                }
                opStack.push({ op: tk, tokenIndex: i });
                resultByIndex[i] = '';
            } else { resultByIndex[i] = ''; }
        }
        while (opStack.length > 0) {
            const top = opStack.pop();
            if (top.op === '(' || top.op === ')') continue;
            opStack.push({ op: top.op, tokenIndex: top.tokenIndex });
            popAndApply();
        }
        let finalResult = valStack.length > 0 ? (valStack[0] ? 1 : 0) : '';
        resultByIndex.push(finalResult);
        return { partials: resultByIndex, final: finalResult };
    }

    function generateTruthTable(expression) {
        const tokens = splitExpression(expression);
        if (tokens.length === 0) return null;
        const tokensWithFinal = tokens.slice();
        tokensWithFinal.push("Final");
        let varsSet = new Set();
        tokens.forEach(t => { if (/[pqrst]/.test(t)) { varsSet.add(t); } });
        let vars = Array.from(varsSet);
        vars.sort();
        let numRows = Math.pow(2, vars.length),
            rows = [],
            finalResults = [];
        for (let i = 0; i < numRows; i++) {
            let assignment = {};
            for (let j = 0; j < vars.length; j++) {
                let bit = (i >> (vars.length - 1 - j)) & 1;
                assignment[vars[j]] = (bit === 1);
            }
            let evaluation = evaluateRowInfix(tokens, assignment);
            let partials = evaluation.partials,
                final = evaluation.final;
            finalResults.push(final);
            rows.push({ assignment, partials });
        }
        let uniqueVals = new Set(finalResults),
            verdict = '';
        if (uniqueVals.size === 1) { verdict = uniqueVals.has(1) ? 'Tautología' : 'Contradicción'; } else { verdict = 'Indeterminación'; }
        return { tokens: tokensWithFinal, vars, rows, verdict };
    }

    function renderTruthTable(tableData) {
        if (!tableData) return '<p style="color:red">Expresión inválida o vacía.</p>';
        const { tokens, rows, verdict } = tableData;
        let html = '<table style="margin:auto; border-collapse:collapse;">';
        html += '<thead><tr>';
        tokens.forEach(tk => { html += `<th style="border:1px solid black; padding:4px;">${tk}</th>`; });
        html += '</tr></thead><tbody>';
        rows.forEach(row => {
            const partials = row.partials;
            html += '<tr>';
            for (let i = 0; i < tokens.length; i++) {
                let cellVal = partials[i] !== undefined ? partials[i] : '';
                html += `<td style="border:1px solid black; padding:4px;">${cellVal}</td>`;
            }
            html += '</tr>';
        });
        html += '</tbody></table>';
        html += `<p><strong>Resultado: ${verdict}</strong></p>`;
        return html;
    }

    // Exportar a PDF
    document.getElementById('btnExportar').addEventListener('click', function() {
        const tableContainer = document.getElementById('resultadoTabla');
        if (tableContainer.innerHTML.trim() === "") {
            alert("Primero genera la tabla de verdad para exportarla.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("La tabla de verdad es:", 10, 20);
        html2canvas(tableContainer, { scale: 2 }).then(function(canvas) {
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth() - 20;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(imgData, 'PNG', 10, 30, pdfWidth, pdfHeight);
            doc.save("tabla_verdad.pdf");
        }).catch(function(error) {
            console.error("Error al generar el PDF:", error);
            alert("Ocurrió un error al generar el PDF. Revisa la consola para más detalles.");
        });
    });

    // ------------------------------
    // Parser y Visualización Interactiva del Árbol Sintáctico
    // ------------------------------
    function tokenizeParser(expr) {
        expr = expr.replace(/\s+/g, '');
        const tokens = [];
        for (let i = 0; i < expr.length; i++) {
            const ch = expr[i];
            if ("pqrst".includes(ch)) { tokens.push({ type: "VAR", value: ch }); } else if ("∧∨¬→↔()".includes(ch)) { tokens.push({ type: "OP", value: ch }); }
        }
        return tokens;
    }

    function parseExpressionParser(expr) {
        const tokens = tokenizeParser(expr);
        let index = 0;

        function peek() { return tokens[index]; }

        function consume() { return tokens[index++]; }

        function parsePrimary() {
            const token = peek();
            if (!token) throw new Error("Expresión incompleta");
            if (token.type === "VAR") { consume(); return { type: "VAR", name: token.value }; }
            if (token.value === "(") {
                consume();
                const node = parseBiconditional();
                if (!peek() || peek().value !== ")") throw new Error("Se esperaba ')'");
                consume();
                return node;
            }
            throw new Error("Token inesperado: " + token.value);
        }

        function parseNot() {
            const token = peek();
            if (token && token.value === "¬") {
                consume();
                const operand = parseNot();
                return { type: "NOT", operand: operand };
            }
            return parsePrimary();
        }

        function parseAnd() {
            let node = parseNot();
            while (peek() && peek().value === "∧") {
                consume();
                const right = parseNot();
                node = { type: "AND", left: node, right: right };
            }
            return node;
        }

        function parseOr() {
            let node = parseAnd();
            while (peek() && peek().value === "∨") {
                consume();
                const right = parseAnd();
                node = { type: "OR", left: node, right: right };
            }
            return node;
        }

        function parseImp() {
            let node = parseOr();
            if (peek() && peek().value === "→") {
                consume();
                const right = parseImp();
                node = { type: "IMP", left: node, right: right };
            }
            return node;
        }

        function parseBiconditional() {
            let node = parseImp();
            while (peek() && peek().value === "↔") {
                consume();
                const right = parseImp();
                node = { type: "BICOND", left: node, right: right };
            }
            return node;
        }
        const tree = parseBiconditional();
        if (index < tokens.length) throw new Error("Tokens sobrantes en la expresión");
        return tree;
    }

    // Adjuntar valores evaluados al AST usando una asignación por defecto
    function attachValuesToAST(ast) {
        const assignment = defaultAssignment(ast);
        return attachValues(ast, assignment);
    }

    // Convertir al formato D3 sin concatenar valores evaluados
    function convertToD3Format(node) {
        if (!node) return null;
        let d3Node = {};
        if (node.type === "VAR") {
            d3Node.name = node.name;
        } else if (node.type === "NOT") {
            d3Node.name = "¬";
            d3Node.children = [convertToD3Format(node.operand)];
        } else if (node.type === "AND") {
            d3Node.name = "∧";
            d3Node.children = [convertToD3Format(node.left), convertToD3Format(node.right)];
        } else if (node.type === "OR") {
            d3Node.name = "∨";
            d3Node.children = [convertToD3Format(node.left), convertToD3Format(node.right)];
        } else if (node.type === "IMP") {
            d3Node.name = "→";
            d3Node.children = [convertToD3Format(node.left), convertToD3Format(node.right)];
        } else if (node.type === "BICOND") {
            d3Node.name = "↔";
            d3Node.children = [convertToD3Format(node.left), convertToD3Format(node.right)];
        } else {
            d3Node.name = node.type;
        }
        return d3Node;
    }

    // Visualizar el árbol en orientación vertical (de arriba hacia abajo) con animación
    function visualizeParseTree(treeData) {
        const margin = { top: 20, right: 90, bottom: 30, left: 90 },
            width = 660 - margin.left - margin.right,
            height = 500 - margin.top - margin.bottom;
        d3.select("#parseTree").select("svg").remove();
        const svg = d3.select("#parseTree").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
        currentSvg = svg;
        const g = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        const zoom = d3.zoom()
            .scaleExtent([0.5, 3])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        svg.call(zoom);
        currentZoomBehavior = zoom;
        // Para orientación vertical, usamos treemap con tamaño [width, height]
        const treemap = d3.tree().size([width, height]);
        const nodes = d3.hierarchy(treeData, d => d.children);
        const treeRoot = treemap(nodes);

        // Animar enlaces: inicialmente, se dibujan en la posición del nodo padre
        const link = g.selectAll(".link")
            .data(treeRoot.descendants().slice(1))
            .enter().append("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-width", 2)
            .attr("d", d => {
                // Inicialmente, la línea se dibuja desde el nodo padre
                return "M" + d.x + "," + d.y + "L" + d.x + "," + d.y;
            });
        link.transition()
            .duration(750)
            .delay(d => d.depth * 300)
            .attr("d", d => {
                return "M" + d.x + "," + d.y +
                    "C" + d.x + "," + (d.y + d.parent.y) / 2 +
                    " " + d.parent.x + "," + (d.y + d.parent.y) / 2 +
                    " " + d.parent.x + "," + d.parent.y;
            });

        // Animar nodos: círculos empiezan con radio 0 y se animan hasta 10
        const node = g.selectAll(".node")
            .data(treeRoot.descendants())
            .enter().append("g")
            .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
            .attr("transform", d => "translate(" + d.x + "," + d.y + ")");

        node.append("circle")
            .attr("r", 0)
            .attr("fill", d => {
                if (d.data.valor === true) return "lightgreen";
                else if (d.data.valor === false) return "lightcoral";
                else return "#fff";
            })
            .attr("stroke", "steelblue")
            .attr("stroke-width", 3)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke", "red").attr("stroke-width", 5);
                d3.select("#tooltip")
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY + 10) + "px")
                    .style("display", "inline-block")
                    .html("<strong>Nodo:</strong> " + d.data.name);
            })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("stroke", "steelblue").attr("stroke-width", 3);
                d3.select("#tooltip").style("display", "none");
            })
            .on("click", function(event, d) {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else if (d._children) {
                    d.children = d._children;
                    d._children = null;
                }
                visualizeParseTree(currentD3TreeData);
            })
            .transition()
            .duration(750)
            .delay(d => d.depth * 300)
            .attr("r", 10);

        node.append("text")
            .attr("dy", ".35em")
            .attr("x", d => d.children ? -13 : 13)
            .style("font-weight", "bold")
            .style("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name)
            .style("opacity", 0)
            .transition()
            .duration(750)
            .delay(d => d.depth * 300)
            .style("opacity", 1);
    }

    // Botón para Resetear Zoom
    document.getElementById('btnResetZoom').addEventListener('click', function() {
        if (currentSvg && currentZoomBehavior) {
            currentSvg.transition().duration(750).call(currentZoomBehavior.transform, d3.zoomIdentity);
        }
    });

    // Al enviar el formulario: genera la tabla de verdad y visualiza el árbol sintáctico
    document.getElementById('tablaVerdadForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const expression = document.getElementById('expresion').value;
        const tableData = generateTruthTable(expression);
        const tableHTML = renderTruthTable(tableData);
        document.getElementById('resultadoTabla').innerHTML = tableHTML;
        try {
            let ast = parseExpressionParser(expression);
            ast = attachValuesToAST(ast);
            const d3TreeData = convertToD3Format(ast);
            currentD3TreeData = d3TreeData;
            visualizeParseTree(d3TreeData);
        } catch (error) {
            console.error("Error al generar el árbol sintáctico:", error);
        }
    });
});