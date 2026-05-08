import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import { formatTime } from "../utils";

ChartJS.register(ArcElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

export function SpeedChart({ history }) {
  const data = {
    labels: history.map((item) => formatTime(item.time)),
    datasets: [
      {
        label: "ISS speed (km/h)",
        data: history.map((item) => Math.round(item.speed)),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.16)",
        pointRadius: 3,
        tension: 0.35,
        fill: true
      }
    ]
  };

  return (
    <div className="chart-card">
      <div>
        <h3>ISS Speed Trend</h3>
        <p>Last {history.length} measurements</p>
      </div>
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { title: { display: true, text: "km/h" }, ticks: { callback: (value) => value.toLocaleString() } },
            x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }
          }
        }}
      />
    </div>
  );
}

export function NewsDistributionChart({ categories, selected, onSelect }) {
  const labels = Object.keys(categories);
  const values = labels.map((label) => categories[label]);
  return (
    <div className="chart-card">
      <div>
        <h3>News Distribution</h3>
        <p>Click a slice to filter articles</p>
      </div>
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444"],
              borderWidth: 0,
              hoverOffset: 10
            }
          ]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
          onClick: (_, elements) => {
            if (!elements.length) return;
            const label = labels[elements[0].index];
            onSelect(selected === label ? "All" : label);
          }
        }}
      />
    </div>
  );
}
