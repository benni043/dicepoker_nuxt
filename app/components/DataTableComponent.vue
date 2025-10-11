<script setup lang="ts">
import type { DataColumnPlayer, DataColumn } from "~/utils/types";

const props = defineProps<{
  dataColumnPlayer: DataColumnPlayer[];
}>();

const rows = [
  { key: "ones", label: "1" },
  { key: "twos", label: "2" },
  { key: "threes", label: "3" },
  { key: "fours", label: "4" },
  { key: "fives", label: "5" },
  { key: "sixes", label: "6" },
  { key: "fullHouse", label: "F" },
  { key: "street", label: "St" },
  { key: "poker", label: "P" },
  { key: "grande", label: "G" },
  { key: "doubleGrande", label: "DG" },
  { key: "sum", label: "Summe" },
];

const flatColumns = props.dataColumnPlayer.flatMap((dcp) =>
  dcp.dataColumns.map((column, index) => ({
    column,
    playerName: dcp.player.name,
    key: `${dcp.player.uuid}-${index}`,
  }))
);
</script>

<template>
  <table class="score-table">
    <thead>
      <tr>
        <th>Poker</th>
        <th v-for="col in flatColumns" :key="col.key">
          {{ col.playerName }}
        </th>
      </tr>
    </thead>

    <tbody>
      <tr v-for="row in rows" :key="row.key">
        <td>{{ row.label }}</td>

        <td v-for="col in flatColumns" :key="col.key">
          <template v-if="row.key === 'sum'">
            {{
              Object.values(col.column).reduce(
                (acc, val) => acc + (val ?? 0),
                0
              )
            }}
          </template>

          <template v-else>
            {{ col.column[row.key as keyof DataColumn] ?? "" }}
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.score-table {
  border-collapse: collapse;
  margin-top: 2rem;
}

.score-table th,
.score-table td {
  border: 2px solid black;
  padding: 6px 12px;
  text-align: center;
}
</style>
