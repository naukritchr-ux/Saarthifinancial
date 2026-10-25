import {useMemo, useState} from 'react';
import {plotData, targetPlan, profileColors, valueText, metricLabels} from '../utils/growthAudit.js';

function linePath(values, x, y) {
  let drawing = false;
  return values.map((value,index) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) { drawing=false; return ''; }
    const piece = `${drawing ? 'L' : 'M'}${x(index).toFixed(2)},${y(Number(value)).toFixed(2)}`;
    drawing=true;
    return piece;
  }).join(' ');
}

export default function GrowthAuditChart({profiles = [], metric = 'company_share', cumulative = false, period, showProjection = true}) {
  const [inspect, setInspect] = useState(null);
  const series = useMemo(() => profiles.map(profile => ({profile, points: plotData(profile,metric,cumulative)})), [profiles,metric,cumulative]);
  if (!series.length) return null;
  const goal = profiles[0].goals.find(row => row.status === 'active' && row.metric === metric);
  const plan = series[0].points.map(row=>targetPlan(row.month,goal,period,cumulative));
  const all = [...series.flatMap(row=>row.points.flatMap(point=>[point.actual,showProjection ? point.projected : null])),...plan].filter(value=>value!==null && Number.isFinite(value));
  const low=Math.min(0,...all), high=Math.max(1,...all), range=high-low || 1;
  const x=index=>86+index*78;
  const y=value=>240-(value-low)/range*210;
  const pointer=event=> {
    const box=event.currentTarget.getBoundingClientRect();
    setInspect(Math.max(0,Math.min(11,Math.round(((event.clientX-box.left)/box.width*1000-86)/78))));
  };
  return <div className="ga-chart">
    <svg viewBox="0 0 1000 290" role="img" aria-label={`${cumulative ? 'Cumulative' : 'Monthly'} ${metricLabels[metric]} for compared profiles`} onPointerMove={pointer}>
      <title>{`${metricLabels[metric]}: recorded results and run-rate outlook`}</title>
      <desc>Solid lines show recorded data. Dashed lines show a run-rate estimate. Current-month actuals are month to date. The target line is a linear pacing plan.</desc>
      {[0,1,2,3,4].map(tick=> {
        const value=low+range*tick/4;
        return <g key={tick}><line x1="86" x2="944" y1={y(value)} y2={y(value)} stroke="#e2e8e7" strokeDasharray="3 4"/>
          <text x="76" y={y(value)+4} textAnchor="end" fontSize="11" fill="#64748b">{valueText(value,metric,true)}</text></g>;
      })}
      {series[0].points.map((point,index)=><text key={point.month} x={x(index)} y="267" textAnchor="middle" fontSize="11" fill="#64748b">
        {new Date(point.month+'-01T00:00:00Z').toLocaleDateString('en-IN',{month:'short',timeZone:'UTC'})}{point.partial ? '*' : ''}</text>)}
      {goal && <path d={linePath(plan,x,y)} stroke="#475569" strokeWidth="2" strokeDasharray="2 5" fill="none"/>}
      {series.map(({profile,points},index)=><g key={profile.scope.key}>
        {showProjection && <path d={linePath(points.map((point,index)=> {
          return point.future || point.partial || (points[index+1]?.future || points[index+1]?.partial) ? point.projected : null;
        }),x,y)} stroke={profileColors[index]} strokeWidth="2.5" strokeDasharray="7 5" fill="none" opacity=".65"/>}
        <path d={linePath(points.map(point=>point.actual),x,y)} stroke={profileColors[index]} strokeWidth="3" fill="none"/>
        {points.map((point,i)=>point.actual !== null && <circle key={point.month} cx={x(i)} cy={y(point.actual)} r="3" fill={profileColors[index]}/>)}
      </g>)}
      {inspect !== null && <line x1={x(inspect)} x2={x(inspect)} y1="20" y2="245" stroke="#94a3b8" strokeDasharray="3 3"/>}
    </svg>
    <div className="ga-chart-legend">{profiles.map((profile,index)=><span key={profile.scope.key}><i style={{background:profileColors[index]}}/>{profile.scope.label}</span>)}
      {goal && <span>··· Primary target plan</span>}
    </div>
    <div className="ga-inspect"><label>Inspect month <select value={inspect ?? ''} onChange={event=>setInspect(event.target.value === '' ? null : Number(event.target.value))}>
      <option value="">Select a month</option>{series[0].points.map((point,index)=><option key={point.month} value={index}>{point.month}{point.partial ? ' · month to date' : ''}</option>)}
    </select></label>{inspect !== null && <div>{series.map(({profile,points},index)=><span key={profile.scope.key} style={{color:profileColors[index]}}>
      {profile.scope.label}: {valueText(points[inspect].actual,metric)}{showProjection && (points[inspect].future || points[inspect].partial) ? ` · Outlook ${valueText(points[inspect].projected,metric)}` : ''}
    </span>)}</div>}</div>
    <p className="ga-note">Solid = recorded · dashed = run-rate estimate · * = current month to date. Forecasts use three complete months, with remaining partial-month days prorated.</p>
  </div>;
}
