var e$z=S(()=>{Dz();R7();el();Cz();Pw_();Fq();r$z=i`CASE
  WHEN ${D_.isUserUpload} THEN 'upload'
  WHEN ${V_.storagePath} LIKE ${n0+"%"} THEN 'reference'
  ELSE 'managed'
END`});