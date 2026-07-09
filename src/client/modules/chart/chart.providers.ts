/* Vendor Dependencies */
import {provideCharts} from 'ng2-charts';
import {
	Chart,
	LineController,
	BarController,
	BubbleController,
	ScatterController,
	DoughnutController,
	CategoryScale,
	LinearScale,
	LogarithmicScale,
	TimeScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Tooltip,
	Filler,
	Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-luxon';

Chart.register(annotationPlugin);

/** Provides chart.js configuration for lazy-loaded section modules */
export function provideChartConfig() {
	return provideCharts({
		registerables: [
			LineController,
			BarController,
			BubbleController,
			ScatterController,
			DoughnutController,
			CategoryScale,
			LinearScale,
			LogarithmicScale,
			TimeScale,
			PointElement,
			LineElement,
			BarElement,
			ArcElement,
			Tooltip,
			Filler,
			Legend,
		],
	});
}
