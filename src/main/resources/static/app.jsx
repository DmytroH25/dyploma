const { useEffect, useMemo, useState } = React;

const defaultCurveForm = {
  p: 79,
  a: -3,
  b: 1,
  gx: 76,
  gy: 46,
  n: 81,
};

const emptyEncryption = {
  command: "MOVE_FORWARD",
  parameter: 10,
};

const emptyDecryption = {
  txX: "",
  txY: "",
  k: "",
};

function pointText(point) {
  if (!point) return "-";
  if (point.infinity) return "O";
  return `(${point.x}, ${point.y})`;
}

function curvePayload(form) {
  return {
    p: Number(form.p),
    a: Number(form.a),
    b: Number(form.b),
    g: { x: Number(form.gx), y: Number(form.gy), infinity: false },
    n: form.n === "" ? null : Number(form.n),
  };
}

function integerOrNull(value) {
  if (value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function mod(value, p) {
  return ((value % p) + p) % p;
}

function validPointsForCurve(form) {
  const p = integerOrNull(form.p);
  const a = integerOrNull(form.a);
  const b = integerOrNull(form.b);
  if (!p || p < 5 || p > 1009 || a === null || b === null) {
    return [];
  }

  const points = [];
  for (let x = 0; x < p; x += 1) {
    const rhs = mod(x * x * x + a * x + b, p);
    for (let y = 0; y < p; y += 1) {
      if (mod(y * y, p) === rhs) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

function containsPoint(form, point) {
  const p = integerOrNull(form.p);
  const a = integerOrNull(form.a);
  const b = integerOrNull(form.b);
  if (!p || p < 5 || a === null || b === null || !point) return false;
  return mod(point.y * point.y, p) === mod(point.x * point.x * point.x + a * point.x + b, p);
}

function inverseMod(value, p) {
  let oldR = mod(value, p);
  let r = p;
  let oldS = 1;
  let s = 0;

  while (r !== 0) {
    const quotient = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  return oldR === 1 ? mod(oldS, p) : null;
}

function addPoints(form, first, second) {
  if (!first) return second;
  if (!second) return first;

  const p = integerOrNull(form.p);
  const a = integerOrNull(form.a);
  if (!p || a === null) return null;

  if (first.x === second.x && mod(first.y + second.y, p) === 0) {
    return null;
  }

  let numerator;
  let denominator;
  if (first.x === second.x && first.y === second.y) {
    numerator = 3 * first.x * first.x + a;
    denominator = 2 * first.y;
  } else {
    numerator = second.y - first.y;
    denominator = second.x - first.x;
  }

  const inverse = inverseMod(denominator, p);
  if (inverse === null) return null;

  const lambda = mod(mod(numerator, p) * inverse, p);
  const x = mod(lambda * lambda - first.x - second.x, p);
  const y = mod(lambda * (first.x - x) - first.y, p);
  return { x, y };
}

function pointOrder(form, point) {
  const p = integerOrNull(form.p);
  if (!p || !containsPoint(form, point)) return null;

  let current = null;
  const max = p + 1 + 2 * Math.floor(Math.sqrt(p)) + 1;
  for (let n = 1; n <= max; n += 1) {
    current = addPoints(form, current, point);
    if (!current) return n;
  }
  return null;
}

function withPointAndOrder(form, point) {
  const next = { ...form, gx: point.x, gy: point.y };
  const order = pointOrder(next, point);
  return { ...next, n: order ?? "" };
}

function nearestBy(items, target, getter) {
  return items.reduce((best, item) => {
    if (!best) return item;
    return Math.abs(getter(item) - target) < Math.abs(getter(best) - target) ? item : best;
  }, null);
}

function snapPointByX(form, nextX, previousX, previousY) {
  const points = validPointsForCurve(form);
  if (points.length === 0) return null;
  const direction = nextX - previousX;
  const existingX = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
  let snappedX = existingX.includes(nextX) ? nextX : null;

  if (snappedX === null && direction > 0) {
    snappedX = existingX.find((x) => x > nextX) ?? existingX[existingX.length - 1];
  }
  if (snappedX === null && direction < 0) {
    snappedX = [...existingX].reverse().find((x) => x < nextX) ?? existingX[0];
  }
  if (snappedX === null) {
    snappedX = nearestBy(existingX, nextX, (x) => x);
  }

  return nearestBy(points.filter((point) => point.x === snappedX), previousY, (point) => point.y);
}

function snapPointByY(form, nextY, previousX, previousY) {
  const points = validPointsForCurve(form);
  if (points.length === 0) return null;
  const direction = nextY - previousY;
  const existingY = [...new Set(points.map((point) => point.y))].sort((a, b) => a - b);
  let snappedY = existingY.includes(nextY) ? nextY : null;

  if (snappedY === null && direction > 0) {
    snappedY = existingY.find((y) => y > nextY) ?? existingY[existingY.length - 1];
  }
  if (snappedY === null && direction < 0) {
    snappedY = [...existingY].reverse().find((y) => y < nextY) ?? existingY[0];
  }
  if (snappedY === null) {
    snappedY = nearestBy(existingY, nextY, (y) => y);
  }

  return nearestBy(points.filter((point) => point.y === snappedY), previousX, (point) => point.x);
}

function snapNearestPoint(form) {
  const points = validPointsForCurve(form);
  if (points.length === 0) return null;
  const gx = integerOrNull(form.gx) ?? 0;
  const gy = integerOrNull(form.gy) ?? 0;
  return points.reduce((best, point) => {
    const score = Math.abs(point.x - gx) + Math.abs(point.y - gy);
    const bestScore = Math.abs(best.x - gx) + Math.abs(best.y - gy);
    return score < bestScore ? point : best;
  }, points[0]);
}

async function api(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Сталася помилка запиту");
  }
  return data;
}

function App() {
  const [mode, setMode] = useState("encrypt");
  const [curveForm, setCurveForm] = useState(defaultCurveForm);
  const [curve, setCurve] = useState(null);
  const [curveError, setCurveError] = useState("");
  const [encryptForm, setEncryptForm] = useState(emptyEncryption);
  const [decryptForm, setDecryptForm] = useState(emptyDecryption);
  const [encryptResult, setEncryptResult] = useState(null);
  const [decryptResult, setDecryptResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingCurve, setCheckingCurve] = useState(false);

  useEffect(() => {
    fetch("/api/ecc/curve")
      .then((response) => response.json())
      .then((data) => {
        setCurve(data);
        setCurveForm({
          p: data.p,
          a: data.a,
          b: data.b,
          gx: data.g.x,
          gy: data.g.y,
          n: data.n,
        });
      })
      .catch(() => setCurveError("Не вдалося завантажити параметри кривої"));
  }, []);

  const commands = useMemo(() => curve?.commands || [], [curve]);
  const activeCurve = useMemo(() => curvePayload(curveForm), [curveForm]);

  async function validateCurve() {
    setCheckingCurve(true);
    setCurveError("");
    setError("");
    try {
      const result = await api("/api/ecc/curve/validate", activeCurve);
      setCurve(result);
      setEncryptResult(null);
      setDecryptResult(null);
      if (!result.commands.some((item) => item.command === encryptForm.command)) {
        setEncryptForm({ ...encryptForm, command: result.commands[0]?.command || "STOP" });
      }
    } catch (event) {
      setCurveError(event.message);
    } finally {
      setCheckingCurve(false);
    }
  }

  async function encrypt() {
    setLoading(true);
    setError("");
    try {
      const result = await api("/api/ecc/encrypt", {
        curve: activeCurve,
        command: encryptForm.command,
        parameter: encryptForm.parameter === "" ? null : Number(encryptForm.parameter),
      });
      setEncryptResult(result);
      setDecryptForm({
        txX: result.Tx.x,
        txY: result.Tx.y,
        k: result.k,
      });
      setMode("encrypt");
    } catch (event) {
      setError(event.message);
    } finally {
      setLoading(false);
    }
  }

  async function decrypt() {
    setLoading(true);
    setError("");
    try {
      const txX = Number(decryptForm.txX);
      const txY = Number(decryptForm.txY);
      const k = Number(decryptForm.k);
      if (!Number.isInteger(txX) || !Number.isInteger(txY)) {
        throw new Error("Координати Tx мають бути цілими числами");
      }
      if (!Number.isInteger(k) || k <= 0) {
        throw new Error("Скаляр k має бути цілим числом більшим за 0");
      }

      const result = await api("/api/ecc/decrypt", {
        curve: activeCurve,
        tx: { x: txX, y: txY, infinity: false },
        k,
      });
      setDecryptResult(result);
    } catch (event) {
      setError(event.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Дипломний демонстратор</p>
          <h1>ECC-шифрування команд управління</h1>
          <p>
            Користувач може змінювати параметри кривої над полем Fp, перевіряти
            базову точку G, автоматично будувати таблицю команд і проходити
            шифрування або дешифрування за формулами еліптичних кривих.
          </p>
        </div>
        <div className="formula-panel">
          <span>Шифрування</span>
          <strong>Tx = Tm + kG</strong>
          <span>Дешифрування</span>
          <strong>Tm = Tx + (-kG)</strong>
        </div>
      </section>

      <section className="layout">
        <aside>
          <CurvePanel
            curve={curve}
            form={curveForm}
            setForm={setCurveForm}
            error={curveError}
            onValidate={validateCurve}
            loading={checkingCurve}
          />
          <CommandTable commands={commands} />
        </aside>

        <section className="workspace">
          <div className="tabs">
            <button className={mode === "encrypt" ? "active" : ""} onClick={() => setMode("encrypt")}>
              Шифрування
            </button>
            <button className={mode === "decrypt" ? "active" : ""} onClick={() => setMode("decrypt")}>
              Дешифрування
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {mode === "encrypt" ? (
            <EncryptionForm
              commands={commands}
              form={encryptForm}
              setForm={setEncryptForm}
              onSubmit={encrypt}
              loading={loading}
              result={encryptResult}
            />
          ) : (
            <DecryptionForm
              form={decryptForm}
              setForm={setDecryptForm}
              onSubmit={decrypt}
              loading={loading}
              result={decryptResult}
            />
          )}
        </section>
      </section>
    </main>
  );
}

function CurvePanel({ curve, form, setForm, error, onValidate, loading }) {
  function update(name, value) {
    const draft = { ...form, [name]: value };
    if (["p", "a", "b"].includes(name)) {
      const currentPoint = { x: integerOrNull(draft.gx), y: integerOrNull(draft.gy) };
      if (currentPoint.x !== null && currentPoint.y !== null && containsPoint(draft, currentPoint)) {
        setForm(withPointAndOrder(draft, currentPoint));
        return;
      }

      const snapped = snapNearestPoint(draft);
      if (snapped) {
        setForm(withPointAndOrder(draft, snapped));
        return;
      }
    }
    setForm(draft);
  }

  function updatePointCoordinate(name, value) {
    if (value === "") {
      setForm({ ...form, [name]: value });
      return;
    }

    const nextValue = Number(value);
    if (!Number.isInteger(nextValue)) {
      return;
    }

    const previousX = integerOrNull(form.gx) ?? 0;
    const previousY = integerOrNull(form.gy) ?? 0;
    const draft = { ...form, [name]: value };
    const snapped = name === "gx"
      ? snapPointByX(draft, nextValue, previousX, previousY)
      : snapPointByY(draft, nextValue, previousX, previousY);

    if (snapped) {
      setForm(withPointAndOrder(draft, snapped));
    } else {
      setForm(draft);
    }
  }

  function snapCurrentPoint() {
    const snapped = snapNearestPoint(form);
    if (snapped) {
      setForm(withPointAndOrder(form, snapped));
    }
  }

  return (
    <section className="panel">
      <h2>Параметри еліптичної кривої</h2>
      <div className="curve-grid">
        <label>p<input type="number" value={form.p} onChange={(e) => update("p", e.target.value)} /></label>
        <label>a<input type="number" value={form.a} onChange={(e) => update("a", e.target.value)} /></label>
        <label>b<input type="number" value={form.b} onChange={(e) => update("b", e.target.value)} /></label>
        <label>G.x<input type="number" min="0" max={Number(form.p) - 1} step="1" value={form.gx} onChange={(e) => updatePointCoordinate("gx", e.target.value)} /></label>
        <label>G.y<input type="number" min="0" max={Number(form.p) - 1} step="1" value={form.gy} onChange={(e) => updatePointCoordinate("gy", e.target.value)} /></label>
        <label>n<input type="number" value={form.n} onChange={(e) => update("n", e.target.value)} /></label>
      </div>
      <button className="secondary full" onClick={snapCurrentPoint}>
        Підібрати найближчу G
      </button>
      <button className="primary full" onClick={onValidate} disabled={loading}>
        {loading ? "Перевірка..." : "Перевірити криву"}
      </button>

      {error && <div className="error compact">{error}</div>}
      {!curve ? (
        <p className="muted">Завантаження...</p>
      ) : (
        <dl className="details curve-status">
          <div><dt>Рівняння</dt><dd>{curve.equation}</dd></div>
          <div><dt>G</dt><dd>{pointText(curve.g)}</dd></div>
          <div><dt>Точок на кривій</dt><dd>{curve.pointCount}</dd></div>
          <div><dt>Порядок G</dt><dd>{curve.subgroupOrder}</dd></div>
          <div><dt>Поле</dt><dd>{curve.primeField ? "p просте" : "p не просте"}</dd></div>
          <div><dt>Стан кривої</dt><dd>{curve.nonsingular ? "несингулярна" : "сингулярна"}</dd></div>
        </dl>
      )}
      <p className="note">
        Таблиця команд нижче будується автоматично: для кожного m шукається
        допустима найближча точка Tm на поточній кривій.
      </p>
    </section>
  );
}

function CommandTable({ commands }) {
  return (
    <section className="panel">
      <h2>Команди управління</h2>
      <div className="table">
        <div className="row head"><span>Команда</span><span>m</span><span>Tm</span></div>
        {commands.map((item) => (
          <div className="row" key={item.command}>
            <span>{item.command}</span>
            <span>{item.m}</span>
            <span>{pointText(item.tm)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EncryptionForm({ commands, form, setForm, onSubmit, loading, result }) {
  return (
    <section className="panel large">
      <h2>Шифрування команди</h2>
      <div className="form-grid">
        <label>
          Команда
          <select
            value={form.command}
            onChange={(event) => setForm({ ...form, command: event.target.value })}
          >
            {commands.map((item) => (
              <option key={item.command} value={item.command}>{item.command}</option>
            ))}
          </select>
        </label>
        <label>
          Параметр команди
          <input
            type="number"
            value={form.parameter}
            onChange={(event) => setForm({ ...form, parameter: event.target.value })}
            placeholder="Наприклад, 10"
          />
        </label>
      </div>
      <button className="primary" onClick={onSubmit} disabled={loading || commands.length === 0}>
        {loading ? "Обчислення..." : "Зашифрувати"}
      </button>

      {result && (
        <ResultBlock
          title="Результат шифрування"
          rows={[
            ["Команда", result.command],
            ["Числове значення m", result.m],
            ["Параметр", result.parameter ?? "-"],
            ["Точка команди Tm", pointText(result.Tm)],
            ["Випадковий скаляр k", result.k],
            ["Маскувальна точка Tk", pointText(result.Tk)],
            ["Криптограма Tx", pointText(result.Tx)],
            ["Формула", result.formula],
          ]}
        />
      )}
    </section>
  );
}

function DecryptionForm({ form, setForm, onSubmit, loading, result }) {
  return (
    <section className="panel large">
      <h2>Дешифрування криптограми</h2>
      <div className="form-grid three">
        <label>
          Tx.x
          <input
            type="number"
            value={form.txX}
            onChange={(event) => setForm({ ...form, txX: event.target.value })}
            placeholder="x"
          />
        </label>
        <label>
          Tx.y
          <input
            type="number"
            value={form.txY}
            onChange={(event) => setForm({ ...form, txY: event.target.value })}
            placeholder="y"
          />
        </label>
        <label>
          k
          <input
            type="number"
            value={form.k}
            onChange={(event) => setForm({ ...form, k: event.target.value })}
            placeholder="k"
          />
        </label>
      </div>
      <button className="primary" onClick={onSubmit} disabled={loading}>
        {loading ? "Обчислення..." : "Дешифрувати"}
      </button>

      {result && (
        <ResultBlock
          title="Результат дешифрування"
          rows={[
            ["Отримана криптограма Tx", pointText(result.Tx)],
            ["Скаляр k", result.k],
            ["Маскувальна точка Tk", pointText(result.Tk)],
            ["Обернена точка -Tk", pointText(result.negativeTk)],
            ["Відновлена точка Tm", pointText(result.Tm)],
            ["Відновлене m", result.m],
            ["Відновлена команда", result.command],
            ["Формула", result.formula],
          ]}
        />
      )}
    </section>
  );
}

function ResultBlock({ title, rows }) {
  return (
    <section className="result">
      <h3>{title}</h3>
      <dl className="details result-details">
        {rows.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
