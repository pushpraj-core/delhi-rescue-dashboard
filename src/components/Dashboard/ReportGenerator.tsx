import React from 'react';
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';
import { FileText } from 'lucide-react';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  header: { fontSize: 24, marginBottom: 20, textAlign: 'center', color: '#1a365d' },
  subheader: { fontSize: 14, marginBottom: 30, textAlign: 'center', color: '#4a5568' },
  section: { margin: 10, padding: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1 solid #e2e8f0', paddingBottom: 5, marginBottom: 10 },
  label: { fontSize: 12, color: '#4a5568' },
  value: { fontSize: 12, fontWeight: 'bold', color: '#2d3748' },
  title: { fontSize: 16, marginBottom: 15, borderBottom: '2 solid #3182ce', paddingBottom: 5 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 10, color: '#a0aec0' }
});

const ReportDocument = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>DCPCR Weekly Impact Report</Text>
      <Text style={styles.subheader}>Generated on {new Date().toLocaleDateString()}</Text>
      
      <View style={styles.section}>
        <Text style={styles.title}>Executive Summary</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total Secure Reports</Text>
          <Text style={styles.value}>{data.total}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>High Priority Cases (Immediate Danger)</Text>
          <Text style={styles.value}>{data.highPriority}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Field Teams Dispatched</Text>
          <Text style={styles.value}>{data.dispatched}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Cases Closed / Resolved</Text>
          <Text style={styles.value}>{data.closed}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Hotspot Density by District</Text>
        {Object.entries(data.districts || {}).map(([district, count]: any) => (
          <View style={styles.row} key={district}>
            <Text style={styles.label}>District {district}</Text>
            <Text style={styles.value}>{count} incident(s)</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        This is a highly confidential document generated securely by the Raksha system.
      </Text>
    </Page>
  </Document>
);

export const ReportGenerator = ({ tickets }: { tickets: any[] }) => {
  // Aggregate metrics
  const stats = {
    total: tickets.length,
    highPriority: tickets.filter(t => t.isEmergency || t.status === 'High Priority').length,
    dispatched: tickets.filter(t => t.status === 'Field Team Dispatched').length,
    closed: tickets.filter(t => t.status === 'Case Closed (CWC)').length,
    districts: tickets.reduce((acc, t) => {
      acc[t.district_id] = (acc[t.district_id] || 0) + 1;
      return acc;
    }, {})
  };

  return (
    <PDFDownloadLink 
      document={<ReportDocument data={stats} />} 
      fileName={`DCPCR_Weekly_Report_${new Date().toISOString().split('T')[0]}.pdf`}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold"
    >
      <FileText className="w-4 h-4" />
      Generate Weekly PDF
    </PDFDownloadLink>
  );
};
