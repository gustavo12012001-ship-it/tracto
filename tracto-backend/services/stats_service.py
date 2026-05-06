"""
stats_service.py — ANOVA de uma via + Tukey HSD para experimentos agronômicos.

Dependência: scipy (já listada no requirements.txt como scipy>=1.11.0)
Fallback manual implementado caso scipy não esteja disponível.
"""

from __future__ import annotations

import logging
import math
from typing import Optional


# ── Tabela q crítico Tukey (α=0.05) ──────────────────────────────────────────
# q[k][df_within] onde k = nº de grupos, df_within = graus de liberdade do erro
# Valores aproximados para uso em campo
_Q_TABLE: dict[int, dict[int, float]] = {
    2:  {5: 3.64, 6: 3.46, 7: 3.34, 8: 3.26, 9: 3.20, 10: 3.15, 12: 3.08, 15: 3.01, 20: 2.95, 30: 2.89, 60: 2.83, 120: 2.80},
    3:  {5: 4.60, 6: 4.34, 7: 4.16, 8: 4.04, 9: 3.95, 10: 3.88, 12: 3.77, 15: 3.67, 20: 3.58, 30: 3.49, 60: 3.40, 120: 3.36},
    4:  {5: 5.22, 6: 4.90, 7: 4.68, 8: 4.53, 9: 4.41, 10: 4.33, 12: 4.20, 15: 4.08, 20: 3.96, 30: 3.85, 60: 3.74, 120: 3.68},
    5:  {5: 5.67, 6: 5.30, 7: 5.06, 8: 4.89, 9: 4.76, 10: 4.65, 12: 4.51, 15: 4.37, 20: 4.23, 30: 4.10, 60: 3.98, 120: 3.92},
    6:  {5: 6.03, 6: 5.63, 7: 5.36, 8: 5.17, 9: 5.02, 10: 4.91, 12: 4.75, 15: 4.59, 20: 4.45, 30: 4.30, 60: 4.16, 120: 4.10},
    7:  {5: 6.33, 6: 5.90, 7: 5.61, 8: 5.40, 9: 5.24, 10: 5.12, 12: 4.95, 15: 4.78, 20: 4.62, 30: 4.46, 60: 4.31, 120: 4.24},
    8:  {5: 6.58, 6: 6.12, 7: 5.82, 8: 5.60, 9: 5.43, 10: 5.30, 12: 5.12, 15: 4.94, 20: 4.77, 30: 4.60, 60: 4.44, 120: 4.36},
    9:  {5: 6.80, 6: 6.32, 7: 6.00, 8: 5.77, 9: 5.59, 10: 5.46, 12: 5.27, 15: 5.08, 20: 4.90, 30: 4.72, 60: 4.55, 120: 4.47},
    10: {5: 6.99, 6: 6.49, 7: 6.15, 8: 5.92, 9: 5.74, 10: 5.60, 12: 5.39, 15: 5.20, 20: 5.01, 30: 4.82, 60: 4.65, 120: 4.56},
}


def _get_q_critical(k: int, df_within: int) -> float:
    """Interpola/extrapola o valor q crítico de Tukey para α=0.05."""
    k = min(max(k, 2), 10)
    row = _Q_TABLE.get(k, _Q_TABLE[10])
    dfs = sorted(row.keys())

    if df_within <= dfs[0]:
        return row[dfs[0]]
    if df_within >= dfs[-1]:
        return row[dfs[-1]]

    for i in range(len(dfs) - 1):
        if dfs[i] <= df_within <= dfs[i + 1]:
            lo, hi = dfs[i], dfs[i + 1]
            t = (df_within - lo) / (hi - lo)
            return row[lo] + t * (row[hi] - row[lo])
    return row[dfs[-1]]


def run_anova_tukey(groups: dict[str, list[float]]) -> dict:
    """
    ANOVA de uma via + Tukey HSD.

    Parameters
    ----------
    groups : {tratamento: [valores]}
        Mínimo 2 grupos, mínimo 2 valores por grupo.

    Returns
    -------
    dict com: anova, means, cv_pct, mse, tukey_groups, interpretation
    """
    if len(groups) < 2:
        raise ValueError("São necessários pelo menos 2 grupos para ANOVA.")

    names = list(groups.keys())
    data_by_group = [list(map(float, groups[n])) for n in names]

    for i, d in enumerate(data_by_group):
        if len(d) < 2:
            raise ValueError(f"Grupo '{names[i]}' precisa de pelo menos 2 observações.")

    # ── Totais ────────────────────────────────────────────────────────────────
    k = len(names)
    all_values = [v for g in data_by_group for v in g]
    N = len(all_values)
    grand_mean = sum(all_values) / N

    # ── Tentativa com scipy ───────────────────────────────────────────────────
    f_stat: float
    p_val: float
    try:
        from scipy.stats import f_oneway  # type: ignore
        result = f_oneway(*data_by_group)
        f_stat = float(result.statistic)
        p_val = float(result.pvalue)
    except ImportError:
        # Cálculo manual
        ss_between = sum(
            len(g) * (sum(g) / len(g) - grand_mean) ** 2
            for g in data_by_group
        )
        ss_within = sum(
            (v - sum(g) / len(g)) ** 2
            for g in data_by_group
            for v in g
        )
        df_between = k - 1
        df_within_calc = N - k
        ms_between = ss_between / df_between if df_between > 0 else 0
        ms_within = ss_within / df_within_calc if df_within_calc > 0 else 1e-9
        f_stat = ms_between / ms_within if ms_within > 0 else 0.0
        # p-valor aproximado (não usar em publicação científica — instale scipy)
        p_val = max(0.0001, 1.0 / (1.0 + f_stat * df_between / 10))

    # ── Graus de liberdade e MSE ──────────────────────────────────────────────
    df_between = k - 1
    df_within = N - k
    ss_within = sum(
        (v - sum(g) / len(g)) ** 2
        for g in data_by_group
        for v in g
    )
    mse = ss_within / df_within if df_within > 0 else 0.0

    # ── Médias por grupo ──────────────────────────────────────────────────────
    group_stats: dict[str, dict] = {}
    for name, g in zip(names, data_by_group):
        n = len(g)
        mean_g = sum(g) / n
        std_g = math.sqrt(sum((v - mean_g) ** 2 for v in g) / max(n - 1, 1))
        group_stats[name] = {"mean": round(mean_g, 4), "std": round(std_g, 4), "n": n, "letter": ""}

    # ── CV% ───────────────────────────────────────────────────────────────────
    cv_pct = (math.sqrt(mse) / grand_mean * 100) if grand_mean != 0 else 0.0

    # ── Tukey HSD ─────────────────────────────────────────────────────────────
    significant = p_val < 0.05

    # Tamanho médio de grupo (harmônico para grupos desbalanceados)
    ns = [len(g) for g in data_by_group]
    n_harmonic = k / sum(1.0 / n for n in ns) if all(n > 0 for n in ns) else sum(ns) / k

    q_crit = _get_q_critical(k, df_within)
    hsd = q_crit * math.sqrt(mse / n_harmonic) if n_harmonic > 0 else 0.0

    # Matriz de diferenças
    sorted_names = sorted(group_stats.keys(), key=lambda n: group_stats[n]["mean"], reverse=True)
    differ: dict[tuple[str, str], bool] = {}
    for i in range(len(sorted_names)):
        for j in range(i + 1, len(sorted_names)):
            a, b = sorted_names[i], sorted_names[j]
            diff = abs(group_stats[a]["mean"] - group_stats[b]["mean"])
            differ[(a, b)] = diff > hsd and significant

    # Atribui letras compactas
    letters: dict[str, set[str]] = {n: set() for n in sorted_names}
    letter_idx = 0
    LETTERS = "abcdefghijklmnopqrstuvwxyz"

    groups_assigned: list[list[str]] = []
    for start in range(len(sorted_names)):
        group_members = [sorted_names[start]]
        for j in range(start + 1, len(sorted_names)):
            candidate = sorted_names[j]
            pair = (sorted_names[start], candidate)
            if not differ.get(pair, False):
                group_members.append(candidate)

        letter = LETTERS[letter_idx % len(LETTERS)]
        letter_idx += 1
        # Só adiciona grupo se tem pelo menos um membro sem essa letra ainda
        new_members = [m for m in group_members if letter not in letters[m]]
        if new_members:
            for m in group_members:
                letters[m].add(letter)
            groups_assigned.append(group_members)

    for name in sorted_names:
        group_stats[name]["letter"] = "".join(sorted(letters[name])) or "a"

    # ── Representação textual dos grupos ─────────────────────────────────────
    tukey_groups = " > ".join(
        f"{n}({group_stats[n]['mean']:.2f}{group_stats[n]['letter']})"
        for n in sorted_names
    )

    # ── Interpretação em PT-BR ────────────────────────────────────────────────
    if not significant:
        interpretation = (
            f"A análise de variância não detectou diferença estatisticamente significativa "
            f"entre os {k} tratamentos (F = {f_stat:.2f}, p = {p_val:.4f}). "
            f"O coeficiente de variação de {cv_pct:.1f}% indica "
            + ("precisão experimental adequada." if cv_pct < 20 else "variação experimental elevada — revise o delineamento.")
        )
    else:
        best = sorted_names[0]
        interpretation = (
            f"Existe diferença estatisticamente significativa entre os tratamentos "
            f"(F = {f_stat:.2f}, p = {p_val:.4f}, α = 0,05). "
            f"O tratamento '{best}' apresentou a maior média ({group_stats[best]['mean']:.2f}). "
            f"Grupos com a mesma letra não diferem pelo teste de Tukey HSD. "
            f"CV = {cv_pct:.1f}%"
            + (" — precisão experimental adequada." if cv_pct < 20 else " — CV elevado, interprete com cautela.")
        )

    return {
        "anova": {
            "f_statistic": round(f_stat, 4),
            "p_value": round(p_val, 6),
            "significant": significant,
            "df_between": df_between,
            "df_within": df_within,
        },
        "means": group_stats,
        "cv_pct": round(cv_pct, 2),
        "mse": round(mse, 6),
        "tukey_groups": tukey_groups,
        "interpretation": interpretation,
    }
